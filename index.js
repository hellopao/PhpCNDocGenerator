/* global Promise */
/// <reference path="typings/node/node.d.ts"/>
var fs = require('fs');
var http = require('http');
var path = require('path');
var util = require('util');
var child_process = require('child_process');

//调试模式下可以通过抓包工具看到请求详情
var debuggerMode = false;

//php中文文档站点配置信息
var DocServer = {
    hostname: "php.net",
    path: "/manual/zh/",
    fileTpl: "function.{func}.php"
};

var DocFile = {
    path: "./docs",
    fileTpl: "{func}.txt"
};

var htmlDecode = function (text) {
    var html_decodes = {
        '&amp;': '&',
        '&quot;': '"',
        '&lt;': '<',
        '&gt;': '>',
        "&nbsp;": " ",
        "&#39;": "'"
    };

    return text.replace(/(&quot;|&lt;|&gt;|&amp;|&nbsp;|&#39;)/g, function (str, item) {
        return html_decodes[item];
    });
};

/**
 * httpAgent
 */
var request = function (conf, cb) {
    var opts = {
        hostname: conf.hostname,
        path: conf.path,
        headers: {
            'host': conf.hostname,
            'user-agent': 'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0.2214.111 Safari/537.36'
        },
        method: "GET",
        agent: false
    };

    if (debuggerMode) {
        //这里的hostname和port是给fiddler等抓包工具用的，用这个可以通过fiddler看到请求详情
        util._extend(opts, {
            hostname: "127.0.0.1",
            port: 8888
        });
    }

    var req = http.request(opts);

    req.on('response', function (res) {
        var chunks = [];
        var size = 0;

        res.on('data', function (chunk) {
            chunks.push(chunk);
            size += chunk.length;
        });

        res.on('end', function () {
            var data = Buffer.concat(chunks, size);

            if (res.statusCode >= 200 && res.statusCode <= 304) {
                cb && cb(null, data, res);
            } else {
                cb && cb(new Error("HTTP FAILED,STATUSCODE: " + res.statusCode), data, res);
            }
        });
    });

    req.on('error', function (err) {
        console.log('HTTP ERROR,URL: %s, ERROR: %s', conf.path, err);
    });

    req.end();
};

/**
 * Promise包装获取php所有函数的方法
 */
var getPhpFuncs = function () {
    return new Promise(function (resolve, reject) {
        //执行php脚本，获取php所有函数
        child_process.exec('php get_php_func.php', function (err, stdout, stderr) {
            if (err) {
                return reject(err);
            }
            var result = stdout.toString();
            try {
                result = JSON.parse(result);
            } catch (error) {
                return reject(err);
            }
            return resolve(result);
        })
    });
};

/**
 * Promise包装写文件的方法
 */
var writeFile = function (filePath, data) {
    return new Promise(function (resolve, reject) {
        fs.writeFile(filePath, data, function (err) {
            if (err) {
                return reject(err);
            }
            return resolve();
        });
    });
};

/**
 * Promise包装读文件的方法
 */
var readFile = function (filePath) {
    return new Promise(function (resolve, reject) {
        fs.readFile(path.join(__dirname, filePath), function (err, data) {
            if (err) {
                return reject(err);
            }
            return resolve(data.toString());
        });
    });
};

/**
 * Promise包装http请求的方法
 */
var requestDefer = function (conf) {
    return new Promise(function (resolve, reject) {
        request(conf, function (err, data, res) {
            if (err) {
                return reject(null);
            }
            return resolve(data.toString());
        })
    });
};

/**
 * 获取php函数对应的文档地址
 */
var getPhpDocUrl = function (funcName) {
    return DocServer.path + DocServer.fileTpl.replace(/{func}/,funcName.replace(/_/g,'-'));
};

/**
 * 解析php函数详情
 */
var parsePhpFunc = function (content) {
    content = content.toString();
    var result = [];
    try {
        var titleMatch = content.match(/<div class="methodsynopsis dc-description">([\s\S]*?)<\/div>/);
        if (titleMatch) {
            var title = titleMatch[1].replace(/<[^>]*>/g,'').replace(/<\/[^>]*>/g,'').replace(/\r?\n/g,'');
            result.push('语法:',title);
        }

        var descMatch = content.match(/<p class="para rdfs-comment">([\s\S]*?)<\/p>/);
        if (descMatch) {
            var desc = descMatch[1].replace(/<[^>]*>/g,'').replace(/<\/[^>]*>/g,'').replace(/\r?\n/g,'').replace(/\s/g,'');
            result.push('说明:',desc);
        }

        var paramMatch = content.match(/<div class="refsect1 parameters"[^>]+>([\s\S]+?)<\/div>/);
        if (paramMatch) {
            var param = paramMatch[1].replace(/<[^>]*>/g,'').replace(/<\/[^>]*>/g,'').replace(/\r?\n/g,'');
            result.push('参数:',param);
        }

        var returnMatch = content.match(/<div class="refsect1 returnvalues"[^>]+>([\s\S]+?)<\/div>/);
        if (returnMatch) {
            var returns = returnMatch[1].replace(/<[^>]*>/g,'').replace(/<\/[^>]*>/g,'').replace(/\r?\n/g,'');
            result.push('返回值:',returns);
        }

        var example = [];
        content.replace(/<div class="example-contents[^"]*">([\s\S]*?)<\/div>/g,function (str,match) {
            example.push(match.replace(/<br\s?\/?>/g,'\n').replace(/<[^>]*>/g,'').replace(/<\/[^>]*>/g,'').replace(/\n{2,}/g,'\n'));
        });

        result.push('示例:',htmlDecode(example.join('')));
        
    } catch (err) {
        console.log('parseDoc Error:%s',err.stack);
    }

    return result.join('\n');
};

/**
 * 生成文档文件
 */
var genDocFile = function(content,funcName){
    return writeFile(path.join(DocFile.path,DocFile.fileTpl.replace(/{func}/,funcName)),content);
};

getPhpFuncs()
    .then(function (funcsNames) {
        var promises = funcsNames.map(function (funcName) {
            var docUrl = getPhpDocUrl(funcName);                
                
            var promise = 
                requestDefer({
                    hostname: DocServer.hostname,
                    path: docUrl
                })
                .then(function(result){
                    var docContent = parsePhpFunc(result);
                    
                    return genDocFile(docContent,funcName);
                })
                
            return promise;             
        });
        
        return Promise.all(promises);       
    })
    .then(function(){
        console.log('done!');
    })
    .catch(function (err) {
        console.log("error: %s",err);
    })
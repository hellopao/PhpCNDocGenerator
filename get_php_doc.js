var fs = require('fs');
var http = require('http');
var path = require('path');

http.globalAgent.maxSockets = 1000;

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

var request = function (options,cb) {
    var req = http.request({
        hostname: "php.net",
        //hostname:'127.0.0.1', //这里的hostname和port是给fiddler用的，用这个可以抓到请求的包
        //port:'8888',
        path: "/manual/zh/function." + options.func.replace(/_/g,'-') + '.php',
        headers: {
            'host':'php.net',
            'user-agent' : 'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0.2214.111 Safari/537.36'
        },
        method: "GET"
    },function (res) {
        var chunks = [];
		var size = 0;

		res.on('data', function(chunk) {
			chunks.push(chunk);
			size += chunk.length;
		});

		res.on('end', function() {
			var data = Buffer.concat(chunks, size);
            
			if (res.statusCode >= 200 && res.statusCode <= 304) {
				cb && cb(null, data, res);
			} else {
				cb && cb(new Error("HTTP REQUEST FAILED " + res.statusCode),data,res);
			}
		});

    })    ;

    req.on('error',function (err) {
        console.log('request %s Error:%s',options.func,err);
    });

    req.end();
}

var writeDoc = function (func,data) {
    return new Promise(function (resolve,reject) {
        fs.writeFile(path.join(__dirname,'docs',func.replace(/_/g,'-') + '.txt'),data,function (err) {
            if (err) {
                return reject(err);
            }
            return resolve();
        });
    });
};

var readFile = function (file) {
    return new Promise(function (resolve,reject) {
        fs.readFile(path.join(__dirname,file),function (err,data) {
             if (err) {
                 return reject(err);
             }
             return resolve(data.toString());
        });
    });    
};

var readdir = function (dir) {
    return new Promise(function (resolve,reject) {
        fs.readdir(dir,function (err,files) {
            if (err) {
                return reject(err);
            }
            return resolve(files);
        })  
    });
};

var requestFuncDoc = function (func) {
    return new Promise(function (resolve,reject) {
        request({
            func: func
        },function (err,data,res) {
            if (err) {
                return resolve(null);
            }
            return resolve(data.toString());
        })  
    });    
};

var getDoc = function (data) {
    var result = [];
    try {
        var titleMatch = data.match(/<div class="methodsynopsis dc-description">([\s\S]*?)<\/div>/);
        if (titleMatch) {
            var title = titleMatch[1].replace(/<[^>]*>/g,'').replace(/<\/[^>]*>/g,'').replace(/\r?\n/g,'');
            result.push('语法:',title);
        }

        var descMatch = data.match(/<p class="para rdfs-comment">([\s\S]*?)<\/p>/);
        if (descMatch) {
            var desc = descMatch[1].replace(/<[^>]*>/g,'').replace(/<\/[^>]*>/g,'').replace(/\r?\n/g,'').replace(/\s/g,'');
            result.push('说明:',desc);
        }

        var paramMatch = data.match(/<div class="refsect1 parameters"[^>]+>([\s\S]+?)<\/div>/);
        if (paramMatch) {
            var param = paramMatch[1].replace(/<[^>]*>/g,'').replace(/<\/[^>]*>/g,'').replace(/\r?\n/g,'');
            result.push('参数:',param);
        }

        var returnMatch = data.match(/<div class="refsect1 returnvalues"[^>]+>([\s\S]+?)<\/div>/);
        if (returnMatch) {
            var returns = returnMatch[1].replace(/<[^>]*>/g,'').replace(/<\/[^>]*>/g,'').replace(/\r?\n/g,'');
            result.push('返回值:',returns);
        }

        var example = [];
        data.replace(/<div class="example-contents[^"]*">([\s\S]*?)<\/div>/g,function (str,match) {
            example.push(match.replace(/<br\s?\/?>/g,'\n').replace(/<[^>]*>/g,'').replace(/<\/[^>]*>/g,'').replace(/\n{2,}/g,'\n'));
        });

        example = example.join('');
        result.push('示例:',htmlDecode(example));
        
    } catch (err) {
        console.log('GetDoc Error:%s',err.stack);
    }

    return result.join('\n');
};

var generate = function (func) {
    return requestFuncDoc(func)
        .then(function (data) {
            if (data) {
                console.log('request %s\'s doc data success',func);
                return getDoc(data);
            }
            return;
        },function (err) {
            console.log('request %s\'s doc data fail: %s',func,err);
        })
        .then(function (data) {
            if (data) {
                return writeDoc(func,data);
            }
        },function (err) {
            console.log("extract %s\'s doc data Error:%s",func,err);
        });
};

Promise.all([readFile('phpfunc.json'),readdir('./docs/')])
    .then(function (result) {
        var phpFuncs = result[0];
        var files = result[1];
        phpFuncs = JSON.parse(phpFuncs);

        return phpFuncs.filter(function (func) {
            return files.indexOf(func.replace(/_/g,'-') + '.txt') === -1;
        });
    })
    .then(function (phpFuncs) {
        var generates = phpFuncs.map(function (func) {
            return generate(func);
        });
        return Promise.all(generates);
    },function (err) {
        console.log('read func.json Error:%s',err);
    })
    .then(function () {
        console.log('done');
    },function (err) {
        console.log('error: %s',err);
    });

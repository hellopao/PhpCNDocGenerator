#php函数中文文档生成器

##背景

在使用`vim`写`php`时会用到[PIV](http://vimawesome.com/plugin/piv-shouldve-said-no)这个插件，在函数上按shift+k就可以查看函数的英文说明文档，非常方便。这个工具生成对应中文文档，方便查阅。
##使用方法
```
    node index.js / run.bat
```

##说明

此工具使用node.js开发，思路如下：
1. 调用php脚本，获取全部php函数
2. 遍历php函数，去[php中文手册网站](http://php.net/manual/zh/)抓取对应函数的html内容
3. 解析html内容，提取函数说明内容，生成文档
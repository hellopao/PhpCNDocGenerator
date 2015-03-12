
#PhpCNDocGenerator

##php函数中文文档生成器

   vim的[PIV](http://vimawesome.com/plugin/piv-shouldve-said-no)插件在写php的时候shift+k就可以查看函数说明文档，很是便利，但苦于英文不好，便写了这个工具,基于node.js。
    思路就是遍历php的所有函数，从[php中文手册](http://php.net/manual/zh/)上抓对应数据生成文档。

##步骤

    1. php get_php_func.php
        运行此命令会在当前目录生成phpfunc.json,文件里包含了所有的php函数

    2. node get_php_doc.js
        运行此命令会在docs目录下生成phpfunc.json里函数的中文说明文档

##说明

    有些函数（例如mysqli_打头的）在php.net上没有对应的文档说明，所以没有生成文档


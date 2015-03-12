<?php
$funcs = array_values(get_defined_functions())[0];
file_put_contents('phpfunc.json',json_encode($funcs));
?>

<?php
	$funcs = array_values(get_defined_functions())[0];
	echo json_encode($funcs);
?>

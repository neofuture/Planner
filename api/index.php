<?php

ini_set('memory_limit', '4096M');
ini_set('max_execution_time', 60);

include("./lib/system.class.php");

$session = '';
$headers = '';

$key = "for(i=0;i<100;i++){est(arr[i]);}";

$encryption = true;

system::processHeaders();

$pdo = system::databaseConnect('owuk_api');

if($encryption) {
  $jsonStr = system::cryptoJsAesDecrypt($key, file_get_contents('php://input'));
} else {
  $jsonStr = json_decode(file_get_contents('php://input'), true);
}

$status['testing'] = 'demo';
$status['called'] = $jsonStr;
$status['headers'] = system::requestHeaders();

if($encryption) {
  echo system::cryptoJsAesEncrypt($key, $status);
} else {
  echo json_encode($status);
}

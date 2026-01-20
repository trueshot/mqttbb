<?php
   $device = $_GET['device'];
   $output = "";
   // unique temp file name
   // time string
   $rand = rand();
   exec('ttzt "'.$device.'" "'.$rand.'"');
   $output = file_get_contents($rand.".txt");
   $tag = file_get_contents('tags/'.$output);
   echo $tag;


  //echo $device;
?>
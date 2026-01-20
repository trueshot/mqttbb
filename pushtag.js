const redis = require('redis');
const thingName = process.argv[2];
const tagName = process.argv[3];

var redisClient = redis.createClient({host:"172.31.29.227", port:"6379",password:"e2c7dd14d6961"})
const fs = require('fs');
//const thisTag = fs.readFileSync('thisTag.txt', 'utf8').trim();
//console.log('thisTag: ', thisTag);
// tread contents of "tags/'"+thisTag+".tag"
const tag = fs.readFileSync('tags/'+   tagName, 'utf8').trim();
const tagTemplate = fs.readFileSync('tagtemplate.txt', 'utf8').trim();
console.log('tag: ', tag);
var obj = {type:"printTag","zpl":tagTemplate.split('\r\n').join('')+tag.split('\r\n').join(''),thingName:thingName}
console.log(obj)
/*
obj = 
{
  "type": "printTag",
  "thingName": "ZebraTail-54_D1_8C",
  "zpl": "^XA\r\n^PW812\r\n^DFR:SAMPLE.ZPL^FS\r\n^PW812\r\n\r\n^FO40,60^A0N,100,70^FN4^FS(desc)\r\n^FO40,160^A0N,60,60^FN10^FS(desc2)\r\n\r\n^FO620,160^A0N,50,50^FDPLU:^FS\r\n^FO620,210^A0N,90,90^FN23^FS(PLU Code)\r\n\r\n^FO40,210^AUN,59,53^FDLot No:^FS\r\n^FO190,210^A0N,59,53^FN1^FS(Lot No)\r\n\r\n^FO80,270^BY3^BUN,100^FN27^FS(barcode-UPC)\r\n\r\n^FO40,420^ASN,40,35^FDHarvest Date:^FS\r\n^FO220,420^A0N,80,56^FN2^FS(Date for Harvest Date)\r\n\r\n^FO40,480^ASN,40,35^FDTag No:^FS\r\n^FO50,530^A0N,70,90^FN7^FS(Tag_id)\r\n\r\n^FO426,283.75^GB406,152.25,2^FS(daughter tag1 box)\r\n^FO720,300^A0N,20,25^FN6^FS(item_no)\r\n^FO460,300^A0N,30,35^FN1^FS(lot_no)\r\n^FO460,325^BY3,2.4^B3N,,70^FN7^FS(barcode)\r\n\r\n^FO426,436^GB406,152.25,2^FS(daughter tag2 box)\r\n^FO720,450^A0N,20,25^FN6^FS(item_no)\r\n^FO460,450^A0N,30,35^FN1^FS(lot_no)\r\n^FO460,475^BY3,2.4^B3N,,70^FN7^FS(barcode)\r\n\r\n^FO40,605^BY2,2^BCN,80,Y,N,,D^FN24^FS(GTIN barcode)\r\n\r\n^FO640,610^AQN,28,24^FDDistributed by:^FS\r\n^FO640,640^ARN,35,31^FDReyna Farms^FS\r\n^FO640,680^ARN,35,41^FDWauchula, FL^FS\r\n\r\n^FO60,730^A0N,50,60^FDProduct of USA^FS\r\n^FO60,780^A0N,50,60^FDWatermelon^FS\r\n^FO460,780^A0N,60,60^FN3^FS(Warehouse)\r\n\r\n^FO620,740^GB200,95,95,,^FS(Box for voicepick)\r\n^FO635,785^CF0,60,60^FR^FN25^FS (Voicepick 1)\r\n^FO695,748^CF0,110,130^FR^FN26^FS (Voicepick 2)\r\n\r\n^FO4000,4000^A0n,1,1^FN1^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN2^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN3^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN4^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN5^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN6^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN7^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN8^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN9^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN10^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN11^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN12^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN13^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN14^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN15^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN16^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN17^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN18^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN19^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN20^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN21^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN22^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN23^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN24^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN25^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN26^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN27^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN28^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN29^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN30^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN31^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN32^FS(offscreen)\r\n^FO4000,4000^A0n,1,1^FN33^FS(offscreen)\r\n^XZ\r\n^XA\r\n^XFR:SAMPLE.GRF\r\n^FN1^FD1051^FS(Lot No)\r\n^FN2^FD05/06/24^FS(Date)\r\n^FN3^FDMAIN^FS(Warehouse)\r\n^FN4^FDSeeded 28 CT^FS(Description)\r\n^FN5^FD1^FS(Qty)\r\n^FN6^FD28SDD^FS(Item No)\r\n^FN7^FD32501^FS(Pallet No)\r\n^FN10^FD^FS(Desc2)\r\n^FN11^FD32501^FS(Pallet No)\r\n^FN12^FD1051^FS(Lot No)\r\n^FN13^FD1^FS(Qty)\r\n^FN14^FD^FS(Trimmed Alias)\r\n^FN16^FD1 of 1^FS\r\n^FN19^FDARCAD     ^FS(ID Name)\r\n^FN20^FDMAIN^FS(Whse Description)\r\n^FN21^FD^FS(repack create)\r\n^FN22^FD^FS(repack consume)\r\n^FN23^FD4031^FS(PLU)\r\n^FN24^FD(01)(13)240506(10)1051^FS(GTIN)\r\n^FN25^FD~~~v1(01)(13)240506(10)1051~~~^FS(Voice Pick 1)\r\n^FN26^FD~~~v2(01)(13)240506(10)1051~~~^FS(Voice Pick 2)\r\n^FN27^FD033383402642^FS(UPC)\r\n^FN28^FDARCAD     ^FS(Grower ID)\r\n^FN29^FDFIELD1  ^FS(Field ID)\r\n^FN30^FDARCAD ^FS(Harvester)\r\n^FN31^FDARCAD ^FS(Packshed ID)\r\n^FN32^FDARCADIA2^FS(Kitname)\r\n^FN33^FD2405061051^FS(voice code data)\r\n^XZ\r\n"
}
*/


redisClient.rpush('TagsToPrint',JSON.stringify(obj),function(err,reply){
  console.log('err: ', err);
  console.log('reply: ', reply);
  process.exit();
})





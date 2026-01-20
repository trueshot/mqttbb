#include "app_events.h"

#include <WiFiClientSecure.h>
extern WiFiClientSecure wifi;
#include <ArduinoMqttClient.h>
extern MqttClient mqtt;

#include <ArduinoJson.h>
#include <M5AtomS3.h>

#include "mqtt.h"

void OnStartup() {

}

int counter = 0;

void OnButton() {
  JsonDocument j;
  j["counter"] = ++counter;
  j["thingName"] = thingName();

  char buf[100];
  size_t len = serializeJson(j, buf, sizeof(buf));
  //Serial2.println("^XA^PW812^DFR:SAMPLE.ZPL^FS^PW812^FO40,60^A0N,100,70^FN4^FS(desc)^FO40,160^A0N,60,60^FN10^FS(desc2)^FO620,160^A0N,50,50^FDPLU:^FS^FO620,210^A0N,90,90^FN23^FS(PLU Code)^FO40,210^AUN,59,53^FDLot No:^FS^FO190,210^A0N,59,53^FN1^FS(Lot No)^FO80,270^BY3^BUN,100^FN27^FS(barcode-UPC)^FO40,420^ASN,40,35^FDHarvest Date:^FS^FO220,420^A0N,80,56^FN2^FS(Date for Harvest Date)^FO40,480^ASN,40,35^FDTag No:^FS^FO50,530^A0N,70,90^FN7^FS(Tag_id)^FO426,283.75^GB406,152.25,2^FS(daughter tag1 box)^FO720,300^A0N,20,25^FN6^FS(item_no)^FO460,300^A0N,30,35^FN1^FS(lot_no)^FO460,325^BY3,2.4^B3N,,70^FN7^FS(barcode)^FO426,436^GB406,152.25,2^FS(daughter tag2 box)^FO720,450^A0N,20,25^FN6^FS(item_no)^FO460,450^A0N,30,35^FN1^FS(lot_no)^FO460,475^BY3,2.4^B3N,,70^FN7^FS(barcode)^FO40,605^BY2,2^BCN,80,Y,N,,D^FN24^FS(GTIN barcode)^FO640,610^AQN,28,24^FDDistributed by:^FS^FO640,640^ARN,35,31^FDArcadia Fruit Co.^FS^FO640,680^ARN,35,41^FDArcadia, FL^FS^FO60,730^A0N,50,60^FDProduct of USA^FS^FO60,780^A0N,50,60^FDWatermelon^FS^FO460,780^A0N,60,60^FN3^FS(Warehouse)^FO620,740^GB200,95,95,,^FS(Box for voicepick)^FO635,785^CF0,60,60^FR^FN25^FS (Voicepick 1)^FO695,748^CF0,110,130^FR^FN26^FS (Voicepick 2)^XZ^XA^XFR:SAMPLE.GRF^FN1^FD1027^FS(Lot No)^FN2^FD11/29/23^FS(Date)^FN4^FDSeedless 36 CNT^FS(Description)^FN5^FD1^FS(Qty)^FN6^FD36SDL^FS(Item No)^FN7^FD20403^FS(Pallet No)^FN9^FDPP1^FS(Computer)^FN11^FD20403^FS(Pallet No)^FN12^FD1027^FS(Lot No)^FN13^FD1^FS(Qty)^FN14^FD^FS(Trimmed Alias)^FN16^FD0 of 0^FS^FN20^FD^FS(Whse Description)^FN21^FD        ^FS(repack create)^FN22^FD        ^FS(repack consume)^FN23^FD4032^FS(PLU)^FN24^FD(01)08508060026050(13)231129(10)1027^FS(GTIN)^FN25^FD61^FS(Voice Pick 1)^FN26^FD63^FS(Voice Pick 2)^FN27^FD033383402406^FS(UPC)^FN28^FDSANDIF  ^FS(Grower ID)^FN29^FD57      ^FS(Field ID)^FN30^FDSANDIF^FS(Harvester)^FN31^FDSANDIF  ^FS(Packshed ID)^FN32^FDSANDIF1   ^FS(Kitname)^FN33^FD085080600260502311291027^FS(voice code data)^XZ");

  Serial.printf("publish %s %d\n", buf, mqttPublish("ZebraTail/announce", (const char *)buf, len));
}

void OnMessage(String &topic, const uint8_t *buf, size_t len, size_t messageSize) {
  Serial.print("Received a message with topic '");
  Serial.print(topic);
  Serial.print("', length ");
  Serial.print(messageSize);
  Serial.print(" bytes");
  Serial.println(len >= messageSize ? ":" : " (incomplete):");
  Serial.write((const char *)buf, len);
  Serial.println();
  Serial2.write((const char *)buf, len);
}


unsigned long lastPost;
int8_t lowRSSI, highRSSI;
constexpr int POST_FREQUENCY = 60;

void OnHeartbeat() {
   JsonDocument doc;
   int8_t rssi = WiFi.RSSI();
   if (!lowRSSI || rssi < lowRSSI) {
      lowRSSI = rssi;
   }
   if (!highRSSI || rssi > highRSSI) {
      highRSSI = rssi;
   }
   unsigned long now = millis();
  if (!lastPost || now - lastPost > POST_FREQUENCY * 1000) {
     lastPost = now;
    doc["type"] = "heartbeat";
    doc["wifi-rssi-high"] = highRSSI;
    doc["wifi-rssi-high"] = highRSSI;
    doc["uptime-ms"] = now;
    doc["thingName"] = thingName();
    lowRSSI = 0;
    highRSSI = 0;
    String jsonStr;
    serializeJson(doc, jsonStr);
    Serial.printf("Sending JSON paayload:\n\t'%s'\n", jsonStr.c_str());
    mqttPublish("ZebraTail/announce", jsonStr.c_str(), jsonStr.length());
//    Serial.println(gRedis->lpush("sandif1zt:zt4:status",jsonStr.c_str()));
  }
}

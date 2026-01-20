const bb = require("./lib/barebones");
const iotsdk = require("aws-iot-device-sdk-v2");
const mqtt = iotsdk.mqtt;

// Validate command-line arguments
if (process.argv.length < 3) {
  console.error("Usage: node testprint.js <thingname>");
  console.error("Example: node testprint.js ZebraTail-5E_9C_D4");
  process.exit(1);
}

// Get the thingname from command line arguments
const thingName = process.argv[2];
const topic = `${thingName}/direct`;

// Define the "Hello World" ZPL message
const helloWorldZPL = "^XA^FO50,50^GB300,200,3^FS^FO75,100^ADN,36,20^FDHello World^FS^XZ";

console.log(`Sending "Hello World" to ${topic}...`);

async function main() {
  // Connect to MQTT broker
  const connection = await bb.connect().catch((error) => {
    console.error('Connection error:', error);
    process.exit(1);
  });

  // Publish the message
  await connection.publish(topic, helloWorldZPL, mqtt.QoS.AtLeastOnce)
    .then(() => {
      console.log('Message published successfully.');
    })
    .catch((error) => {
      console.error('Failed to publish message:', error);
    });

  // Disconnect
  await bb.disconnect(connection);
  console.log('Disconnected from MQTT broker.');
  process.exit(0);
}

// Run the main function
main();
const bb = require("./lib/barebones");
const iotsdk = require("aws-iot-device-sdk-v2");
const mqtt = iotsdk.mqtt;
const redis = require('redis');

// Configure Redis client
const client = redis.createClient({
  host: '54.173.45.122',
  port: '6379',
  password: 'e2c7dd14d6961'
});

// Function that simulates printing the tag data
function printTag(tagData) {
  console.log("Printing tag:", tagData);
  // Add the actual printing logic here
}

// Function to watch the list and process tags
function watchAndPrint() {
  client.blpop('TagsToPrint', 0, function(err, [key, tagData]) {
    if (err) {
      console.error('Error while popping or printing tag:', err);
      return;
    }
    printTag(tagData);
    // Continue watching after processing the current tag
    watchAndPrint();
  });
}

// Handle exit gracefully
process.on("SIGINT", function () {
  console.log("Terminating client...");
  client.quit();
  process.exit();
});

// Start the watching process
watchAndPrint();

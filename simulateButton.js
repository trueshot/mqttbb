#!/usr/bin/env node

// Use the same barebones library as your ReceiveAnnounce.js
const bb = require("./lib/barebones");
const { sendOne } = require("./lib/pubsub");

// Get the thingName from command line arguments
const thingName = process.argv[2];

if (!thingName) {
  console.error('Error: thingName is required');
  console.error('Usage: node simulateButton.js <thingName>');
  process.exit(1);
}

async function main() {
  console.log(`Simulating button push for device: ${thingName}`);
  
  try {
    // Connect to AWS IoT using the same connection logic as ReceiveAnnounce.js
    const connection = await bb.connect();
    console.log("Connected to AWS IoT");
    
    // Create the button press message
    const buttonMessage = {
      type: 'button',
      counter: 1,
      'free-heap': 217972,
      thingName: thingName
    };
    
    // Send the message using the same method as your application
    await sendOne(connection, "ZebraTail/announce", buttonMessage);
    console.log("Button press message sent successfully:");
    console.log(JSON.stringify(buttonMessage, null, 2));
    
    // Disconnect
    await bb.disconnect(connection);
    console.log("Disconnected from AWS IoT");
    
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
const redis = require('redis');
const client = redis.createClient({
  host: '54.173.45.122',
  port: '6379',
  password: 'e2c7dd14d6961',
  legacyMode: true
});

client.on('error', function(err) {
  console.log('Redis error:', err);
});

client.on('connect', function() {
  console.log('Connected to Redis, starting distribution...');
  distributeTags();
});

function printLabel(printerId, labelData) {
  console.log(`Printer ${printerId}: Printing label ${labelData}`);
  // Actual printing logic goes here.
}

const printers = {};

function startPrinting(printerId, rateLimit) {
  if (!printers[printerId]) {
    console.log(`Starting interval for ${printerId} with rate limit ${rateLimit} ms`);
    printers[printerId] = setInterval(() => {
      console.log(`Attempting to print for ${printerId}`);
      client.lpop(`printer_queue:${printerId}`, (err, labelData) => {
        if (err) {
          console.error(`Error popping from ${printerId} queue:`, err);
          return;
        }
        if (labelData) {
          printLabel(printerId, labelData);
        } else {
          console.log(`No more labels to print for ${printerId}, stopping interval.`);
          clearInterval(printers[printerId]);
          delete printers[printerId];
        }
      });
    }, rateLimit);
  }
}

function distributeTags() {
  client.blpop('TagsToPrint1', 0, (err, [key, job]) => {
    if (err) {
      console.error('Error popping from TagsToPrint:', err);
      return;
    }
    console.log('Distributing job:', job);
    const { printerId, data } = JSON.parse(job);
    client.rpush(`printer_queue:${printerId}`, job, (err) => {
      if (err) {
        console.error('Error pushing to printer queue:', err);
        return;
      }
      startPrinting(printerId, 1000); // Ensures printing starts if not already started
      distributeTags(); // Recursively call to continue processing
    });
  });
}

// To manually start an interval for a specific printer if needed
 startPrinting('printer1', 1000);

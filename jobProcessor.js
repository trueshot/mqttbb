const redis = require('redis');
const client = redis.createClient({
  host: '54.173.45.122',
  port: '6379',
  password: 'e2c7dd14d6961',
  legacyMode: true
});
const subClient = redis.createClient({
  host: '54.173.45.122',
  port: '6379',
  password: 'e2c7dd14d6961',
  legacyMode: true
});
const pubClient = redis.createClient({
  host: '54.173.45.122',
  port: '6379',
  password: 'e2c7dd14d6961',
  legacyMode: true
});

// Subscribe to expired events
subClient.subscribe('__keyevent@0__:expired', (message) => {
    console.log('Received expiration event:', message);

    // Fetch the job data from the expired key
    pubClient.get(message, (err, jobData) => {
        if (err) {
            console.error('Error fetching expired job:', err);
        } else if (jobData) {
            // Here we assume the jobData is valid and handle it
            console.log('Processing job:', jobData);
            const job = JSON.parse(jobData);
            printLabel(job.printerId, job.data);
            pubClient.del(message); // Clean up the key explicitly if necessary
        }
    });
});

function printLabel(printerId, labelData) {
    console.log(`Printer ${printerId}: Printing label`, labelData);
    // Actual printing logic goes here.
}

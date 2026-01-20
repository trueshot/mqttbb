const redis = require('redis');
const client = redis.createClient({
  host: '54.173.45.122',
  port: '6379',
  password: 'e2c7dd14d6961',
  legacyMode: true
});

function enqueueJob(printerId, data, delay) {
    const tempKey = `temp:job:${printerId}:${Date.now()}`;
    const jobData = JSON.stringify({ printerId, data });

    client.set(tempKey, jobData, 'EX', delay, (err) => {
        if (err) {
            console.error('Failed to set job:', err);
        } else {
            console.log(`Job enqueued with delay ${delay}s: ${jobData}`);
        }
    });
}

// Example usage
enqueueJob('printer1', 'Label Data for Printer 1', 10); // Delay is in seconds

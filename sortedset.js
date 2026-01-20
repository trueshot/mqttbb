const redis = require('redis');
const client = redis.createClient({
    host: '54.173.45.122',
    port: '6379',
    password: 'e2c7dd14d6961',
    legacyMode: true
});
client.on('error', (err) => console.log('Redis Client Error', err));

// Function to enqueue jobs with automatic scheduling
function enqueueJob(printerId, data) {
    const now = Math.floor(Date.now() / 1000);
    console.log('before zrevrange');
    client.zrevrange(`printer_jobs:${printerId}`, 0, 0, 'WITHSCORES', (err, lastJob) => {
        console.log('zrevrange');
        if (err) {
            console.error(`Failed to retrieve last job for printer ${printerId}:`, err);
            return;
        }
        
        let delayInSeconds;
        if (lastJob.length === 0) {
            delayInSeconds = now;
        } else {
            const lastJobScore = parseInt(lastJob[1]);
            delayInSeconds = lastJobScore + 1.5;
        }
        
        const jobData = JSON.stringify({ printerId, data, scheduledTime: delayInSeconds });
        console.log('before zadd');
        client.zadd(`printer_jobs:${printerId}`, delayInSeconds, jobData, (err) => {
            console.log('after zadd');
            if (err) {
                console.error('Failed to enqueue job:', err);
            } else {
                console.log(`Job for printer ${printerId} enqueued to run at ${new Date(delayInSeconds * 1000).toLocaleTimeString()}`);
                // Add printer to the active set
                client.sadd('active_printers', printerId);
            }
        });
    });
}


// Example usage with promises for controlled job enqueueing
function handleIncomingJob(printerId, data, delay) {
    return new Promise((resolve) => {
        setTimeout(() => {
            enqueueJob(printerId, data);
            resolve();  // Resolve the promise after the job is enqueued
        }, 50);
    });
}


// Example usage with promises
handleIncomingJob('ZebraTail-54_D1_8C/direct', '2000')
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2001'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2002'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2003'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2004'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2005'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2006'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2007'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2008'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2009'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2010'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2011'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2012'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2013'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2014'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2015'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2016'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2017'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2018'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2019'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2020'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2021'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2022'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2023'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2024'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2025'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2026'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2027'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2028'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2029'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2030'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2031'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2032'))
    .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2033'))
      .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2034'))
      .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2035'))
      .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2036'))
      .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2037'))
      .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2038'))
      .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2039'))
      .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2040'))
      .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2041'))
      .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2042'))
      .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2043'))
      .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2044'))
      .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2045'))
      .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2046'))
      .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2047'))
      .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2048'))
      .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2049'))
      .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2050'))
      .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2051'))
      .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2052'))
      .then(() => handleIncomingJob('ZebraTail-54_D1_8C/direct', '2053'))




.then(() => {
        console.log("All jobs have been queued.");
        //checkActivePrinters(); // Start the loop to process jobs
    });

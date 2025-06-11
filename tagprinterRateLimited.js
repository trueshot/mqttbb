const crypto = require('crypto');

function generateHash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}
const EVENT_EXPIRY = 24 * 60 * 60;

const storeEvent = (ulid, eventData) => {
    var redisClient = client
    const transactKey = `events:transacts:${ulid}`;
    redisClient.rpush(transactKey, JSON.stringify({
        timestamp: Date.now(),
        component: 'tagprinterRateLimited',
        ...eventData
    }));
    // Set expiry if this is first event in list
    redisClient.expire(transactKey, 24 * 60 * 60);
};
const redis = require('redis');
const { promisify } = require('util');

const client = redis.createClient({
    host: '54.173.45.122',
    port: '6379',
    password: 'e2c7dd14d6961',
    legacyMode: true
});
client.on('error', (err) => console.log('Redis Client Error', err));
var log4js = require('log4js');
// heartbeat, boot, button, initialize
log4js.configure({
  appenders: {
      info: { type: 'file', filename: 'rateLimited-info.log' },
      error: { type: 'file', filename: 'rateLimited-error.log' },
      filterInfo: {
          type: 'logLevelFilter',
          appender: 'info',
          level: 'info',
          maxLevel: 'info'
      },
      filterError: {
          type: 'logLevelFilter',
          appender: 'error',
          level: 'error'
      }
  },
  categories: {
      default: { appenders: ['filterInfo', 'filterError'], level: 'info' }
  }
});

var logger = log4js.getLogger();


// Promisify necessary Redis commands
const zrangebyscoreAsync = promisify(client.zrangebyscore).bind(client);
const getAsync = promisify(client.get).bind(client);
const setexAsync = promisify(client.setex).bind(client);
const zremAsync = promisify(client.zrem).bind(client);

function processJobs(printerId) {
    const now = Math.floor(Date.now() / 1000);
    zrangebyscoreAsync(`printer_jobs:${printerId}`, 0, now)
        .then(jobs => {
            let promiseChain = Promise.resolve(); // Start with a resolved promise for chaining

            jobs.forEach(jobData => {
                promiseChain = promiseChain.then(() => {
                    const job = JSON.parse(jobData);
                    const jobHash = generateHash(jobData);
console.log('jobData',jobData);
                    return getAsync(`hash:job:${jobHash}`).then(exists => {
                        if (!exists) {
                            console.log(`Processing job for printer ${printerId}`);
                            logger.info(`Processing job for printer ${printerId}: ${jobData}`);
                            return printLabel(job.printerId, job.data)
                                .then(() => setexAsync(`hash:job:${jobHash}`, 30, 'exists'))
                                .then(() => zremAsync(`printer_jobs:${printerId}`, jobData));
                        } else {
                            console.log(`Job already processed, skipping: ${jobData}`);
                            logger.error(`Job already processed, skipping: ${jobData}`);
                            return Promise.resolve(); // Continue chain without action
                        }
                    });
                }).catch(err => {
                    console.error(`Error processing job ${jobData}:`, err);
                    logger.error(`Error processing job ${jobData}:`, err);
                });
            });

            return promiseChain; // Return the final promise from the chain
        })
        .catch(err => {
            console.error(`Error retrieving jobs for printer ${printerId}:`, err);
            logger.error(`Error retrieving jobs for printer ${printerId}:`, err);
        });
}

function printLabel(printerId, labelData) {

    return new Promise((resolve, reject) => {
        //var obj = {"type": "printTag","thingName": "ZebraTail-54_D1_8C","zpl": "^XA\r\n^XFR:PALLET.GRF\r\n^FN1^FD"+labelData+"^FS(Lot No)\r\n^FN2^FD05/06/24^FS(Date)\r\n^FN3^FDMAIN^FS(Warehouse)\r\n^FN4^FDSeeded 28 CT^FS(Description)\r\n^FN5^FD1^FS(Qty)\r\n^FN6^FD28SDD^FS(Item No)\r\n^FN7^FD32593^FS(Pallet No)\r\n^FN10^FD^FS(Desc2)\r\n^FN11^FD32593^FS(Pallet No)\r\n^FN12^FD1051^FS(Lot No)\r\n^FN13^FD1^FS(Qty)\r\n^FN14^FD^FS(Trimmed Alias)\r\n^FN16^FD1 of 1^FS\r\n^FN19^FDARCAD     ^FS(ID Name)\r\n^FN20^FDMAIN^FS(Whse Description)\r\n^FN21^FD^FS(repack create)\r\n^FN22^FD^FS(repack consume)\r\n^FN23^FD4031^FS(PLU)\r\n^FN24^FD(01)(13)240506(10)1051^FS(GTIN)\r\n^FN25^FD~~~v1(01)(13)240506(10)1051~~~^FS(Voice Pick 1)\r\n^FN26^FD~~~v2(01)(13)240506(10)1051~~~^FS(Voice Pick 2)\r\n^FN27^FD033383402642^FS(UPC)\r\n^FN28^FDARCAD     ^FS(Grower ID)\r\n^FN29^FDFIELD1  ^FS(Field ID)\r\n^FN30^FDARCAD ^FS(Harvester)\r\n^FN31^FDARCAD ^FS(Packshed ID)\r\n^FN32^FDARCADIA2^FS(Kitname)\r\n^FN33^FD2405061051^FS(voice code data)\r\n^XZ\r\n"}
        const data = JSON.parse(labelData);
        if (data.ulid) {
            storeEvent(data.ulid, {
                action: 'rate_limited_printing',
                printerId: printerId,
                thingName: data.thingName,
                type: data.type
            });
        }
        client.rpush('TagsToPrint',labelData, (err, reply) => {
            if (err) {
                console.error('Error pushing label to Redis:', err);
                if (data.ulid) {
                    storeEvent(data.ulid, {
                        action: 'error',
                        error: err.message
                    });
                }
                reject(err);
            } else {
                console.log(`Printer ${printerId} Printing label `+labelData.substr(30,50));
                logger.info(`Printer ${printerId}: Printing label ${labelData}`);
                if (data.ulid) {
                    storeEvent(data.ulid, {
                        action: 'queued_for_printing',
                        printerId: printerId
                    });
                }             
                resolve(reply);
            }
        });
    });
}

function checkActivePrinters() {
    client.smembers('active_printers', (err, printers) => {
        if (err) {
            console.error('Error fetching active printers:', err);
            return;
        }
        printers.forEach(processJobs);
    });
    setTimeout(checkActivePrinters, 1000); // Check every second
}

checkActivePrinters(); // Start the loop to process jobs

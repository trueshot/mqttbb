const redis = require('redis');
const request = require('request');
const crypto = require('crypto');
const EVENT_EXPIRY = 24 * 60 * 60; // 24 hours in seconds

const redisClient = redis.createClient({
    host: '54.173.45.122',
    port: '6379',
    password: 'e2c7dd14d6961',
    legacyMode: true
});
var log4js = require('log4js');

log4js.configure({
   appenders: {
      // Define the files to write logs to
      infoFile: { type: 'file', filename: 'processButton-info.log' },
      errorFile: { type: 'file', filename: 'processButton-error.log' },

      // Filter for only 'info' level logs
      info: { 
          type: 'logLevelFilter', 
          appender: 'infoFile', 
          level: 'info', 
          maxLevel: 'info' 
      },

      // Filter for only 'error' level logs
      error: { 
          type: 'logLevelFilter', 
          appender: 'errorFile', 
          level: 'error'
      }
   },
   categories: {
      default: { appenders: ['info', 'error'], level: 'info' }
   }
});

var buttonLogger = log4js.getLogger('processButton');

// Add storeEvent function
const storeEvent = (ulid, eventData) => {
    const transactKey = `events:transacts:${ulid}`;
    redisClient.rpush(transactKey, JSON.stringify({
        timestamp: Date.now(),
        ...eventData
    }));
};

redisClient.on('error', (err) => console.log('Redis Client Error', err));
var ZTobj = {}
function listenForButton() {
    //console.log('blocking')
    redisClient.blpop('ButtonPushed', 0, function (err, result) {
        if (err) {
            console.log('Error: ', err);
            return;
        }
        
        
        const Mobj = JSON.parse(result[1]);
        const ulid = Mobj.ulid; // Get the original ulid

        // Store the button processing start event
        storeEvent(ulid, {
            type: 'process_button_start',
            thingName: Mobj.thingName,
        });        
        const thingName = Mobj.thingName.replace('ZebraTail-', 'ZT').replace(/_/g, '');
        
       
        console.log(bg.Blue,fg.Green, 'button',bg.Black,fg.Yellow,showProj(Mobj.thingName),Mobj.thingName,new Date(), "\x1b[0m");
        buttonLogger.info('button',showProj(Mobj.thingName),Mobj.thingName,new Date());
        console.log('thingName: ', 'BROCCOLI:DEVICES:' + thingName);
        buttonLogger.info('thingName: ', 'BROCCOLI:DEVICES:' + thingName);


        redisClient.get('BROCCOLI:DEVICES:' + thingName, function (err, result) {
            if (err) {
                console.log('Error: ', err);
                return;
            }
            //console.log('Result: ', result);
            const device = JSON.parse(result);
            const formattedThingName = device.NAME.replace('ZT', 'ZebraTail-').replace(/_/g, '_');
            // Store device lookup event
            storeEvent(ulid, {
                type: 'device_lookup',
                thingName: formattedThingName,
                project: device.PROJS
            });
console.log('------Mobj')            
console.log(Mobj)            
console.log('Mobj------')
            if (Mobj.zt) device.zt = Mobj.zt            
            let theQty = device.BUTTONQTY || 1;
            processRequests(0, theQty, formattedThingName, device.PROJS, theQty,ulid,device.zt);
        });
    });
}

function processRequests(index, max, thingName, project, counter, ulid,zt) {
    if (index >= max) {
        //console.log('All jobs have been queued.');
        listenForButton(); // Recall the listenForButton to continue listening for new events
        return;
    }
    const url = `https://${project}.produceflow.com/zt.php?device=${thingName}&counter=${counter}&zt=${zt}`;
    console.log('url: ', url);
        // Store HTTP request start
    storeEvent(ulid, {
        type: 'http_request_start',
        thingName: thingName,
        url: url
    });
    // log url
    buttonLogger.info('url: ', url,thingName,project,counter);

    request(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
           storeEvent(ulid, {
               type: 'http_request_complete',
               thingName: thingName,
               zpl: body,
               status: response.statusCode
           });      
            const obj = {
                type: 'printTag',
                thingName: thingName,
                zpl: body.split('\r\n').join(''),
                //zpl: body.split('/r/n').join(''),
                //zpl: body.replace(/(\r\n|\r|\n)/g, ''),
                //zpl: body.replace(/(\r\n|\r|\n)/g, ''),
                ulid: ulid
            };
            handleIncomingJob(thingName, JSON.stringify(obj),ulid)
                .then(() => {
                    console.log('Job processed:', obj.thingName);
                    buttonLogger.info('Job processed:', obj);
                    processRequests(index + 1, max, thingName, project, counter, ulid); // Call recursively after promise resolves
                });
        } else {
            console.log('error: ', error);
            buttonLogger.error('error: ', error);
            // If there's an error, you might still want to try the next request or retry the current one based on your logic
            processRequests(index + 1, max, thingName, project, counter, ulid);
        }
    });
}

function handleIncomingJob(printerId, data, ulid) {
    return new Promise((resolve) => {
        setTimeout(() => {
            enqueueJob(printerId, data,ulid)
                .then(resolve) // Properly pass resolve as a function reference
                .catch(error => {
                    console.error('Failed to enqueue job:', error);
                    // Handle error or reject if necessary
                });
        }, 50);
    });
}

function enqueueJob(printerId, data,ulid) {
    return new Promise((resolve, reject) => {
        const now = Math.floor(Date.now() / 1000);
        //console.log('before zrevrange');
        redisClient.zrevrange(`printer_jobs:${printerId}`, 0, 0, 'WITHSCORES', (err, lastJob) => {
            if (err) {
                console.error(`Failed to retrieve last job for printer ${printerId}:`, err);
                // log error
                buttonLogger.error(`Failed to retrieve last job for printer ${printerId}:`, err);
                reject(err);  // Reject the promise if there is an error
                return;
            }

            let delayInSeconds = lastJob.length === 0 ? now : parseInt(lastJob[1]) + 1.5;
            const jobData = JSON.stringify({ printerId, data, scheduledTime: delayInSeconds });

            //console.log('before zadd');
            redisClient.zadd(`printer_jobs:${printerId}`, delayInSeconds, jobData, (err) => {
                if (err) {
                    console.error('Failed to enqueue job:', err);
                    // log error
                    buttonLogger.error('Failed to enqueue job:', err);
                    reject(err);  // Reject the promise if there is an error
                } else {
                    //console.log('after zadd');
                    console.log(`Job for printer ${printerId} enqueued to run at ${new Date(delayInSeconds * 1000).toLocaleTimeString()}`);
                    // log job enqueued
                    buttonLogger.info(`Job for printer ${printerId} enqueued to run at ${new Date(delayInSeconds * 1000).toLocaleTimeString()}`);
                    // Store print job enqueued event
                    storeEvent(ulid, {
                        type: 'print_job_enqueued',
                        thingName: printerId,
                        scheduledTime: delayInSeconds
                    });

                    redisClient.sadd('active_printers', printerId);
                    resolve();  // Resolve the promise after all async operations are done
                }
            });
        });
    });
}

function enqueueJob1(printerId, data) {
    const now = Math.floor(Date.now() / 1000);
    console.log('before zrevrange');
    redisClient.zrevrange(`printer_jobs:${printerId}`, 0, 0, 'WITHSCORES', (err, lastJob) => {
        console.log('zrevrange');
        if (err) {
            console.error(`Failed to retrieve last job for printer ${printerId}:`, err);
            // log error
            buttonLogger.error(`Failed to retrieve last job for printer ${printerId}:`, err);
            return;
        }

        let delayInSeconds = lastJob.length === 0 ? now : parseInt(lastJob[1]) + 1.5;
        const jobData = JSON.stringify({ printerId, data, scheduledTime: delayInSeconds });

        console.log('before zadd');
        redisClient.zadd(`printer_jobs:${printerId}`, delayInSeconds, jobData, (err) => {
            console.log('after zadd');
            if (err) {
                console.error('Failed to enqueue job:', err);
                // log error
                buttonLogger.error('Failed to enqueue job:', err);
            } else {
                console.log(`Job for printer ${printerId} enqueued to run at ${new Date(delayInSeconds * 1000).toLocaleTimeString()}`);
                // log job enqueued
                buttonLogger.info(`Job for printer ${printerId} enqueued to run at ${new Date(delayInSeconds * 1000).toLocaleTimeString()}`);
                redisClient.sadd('active_printers', printerId);
            }
        });
    });
}
var showProj = function(zt) {
   if (ZTobj.hasOwnProperty(zt)) {
      return ZTobj[zt].PROJS
   } else {
      lookUpZT(zt)
      return "pending..."
   }
}
var lookUpZT = function(zt) {
   var thingName = zt.replace('ZebraTail-', 'ZT').replace(/_/g, '');
   var theThing
   redisClient.get('BROCCOLI:DEVICES:'+thingName,function(err,theThing) {
      theThing = JSON.parse(theThing)
      ZTobj[theThing.NAME] = theThing
   })
}

// Reset = "\x1b[0m"
// Bright = "\x1b[1m"
// Dim = "\x1b[2m"
// Underscore = "\x1b[4m"
// Blink = "\x1b[5m"
// Reverse = "\x1b[7m"
// Hidden = "\x1b[8m"

// Foreground colors
const fg = {
  Black: "\x1b[30m",
  Red: "\x1b[31m",
  Green: "\x1b[32m",
  Yellow: "\x1b[33m",
  Blue: "\x1b[34m",
  Magenta: "\x1b[35m",
  Cyan: "\x1b[36m",
  White: "\x1b[37m"
};

// Background colors
const bg = {
  Black: "\x1b[40m",
  Red: "\x1b[41m",
  Green: "\x1b[42m",
  Yellow: "\x1b[43m",
  Blue: "\x1b[44m",
  Magenta: "\x1b[45m",
  Cyan: "\x1b[46m",
  White: "\x1b[47m"
};

listenForButton();

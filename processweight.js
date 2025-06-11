const redis = require('redis');
const request = require('request');
const crypto = require('crypto');

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
      infoFile: { type: 'file', filename: 'processWeight-info.log' },
      errorFile: { type: 'file', filename: 'processWeight-error.log' },

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

var weightLogger = log4js.getLogger('processWeight');


redisClient.on('error', (err) => console.log('Redis Client Error', err));
var ZTobj = {}
function listenForWeight() {
    console.log('blocking')
    redisClient.blpop('WeightPushed', 0, function (err, result) {
        if (err) {
            console.log('Error: ', err);
            return;
        }
        const Mobj = JSON.parse(result[1]);
        console.log(Mobj)
        var project = Mobj.projs
        console.log('project',project)
        const thingName = Mobj.thingName.replace('ZebraTail-', 'ZT').replace(/_/g, '');
        console.log(bg.Blue,fg.Green, 'weight',bg.Black,fg.Yellow,showProj(Mobj.thingName),Mobj.thingName,new Date(), "\x1b[0m");
        weightLogger.info('weight',showProj(Mobj.thingName),Mobj.thingName,new Date());
        console.log('thingName: ', 'BROCCOLI:DEVICES:' + thingName);
        weightLogger.info('thingName: ', 'BROCCOLI:DEVICES:' + thingName);
         // Regular expressions to match the weights
         const grossWeightRegex = /(\d+)lb GR/;
         const tareWeightRegex = /(\d+)lb TA/;
         const netWeightRegex = /(\d+)lb NT/;

         // Parsing the weights
         const grossWeightMatch = Mobj.reading.match(grossWeightRegex);
         const tareWeightMatch = Mobj.reading.match(tareWeightRegex);
         const netWeightMatch = Mobj.reading.match(netWeightRegex);

         const grossWeight = grossWeightMatch ? parseInt(grossWeightMatch[1], 10) : null;
         const tareWeight = tareWeightMatch ? parseInt(tareWeightMatch[1], 10) : null;
         const netWeight = netWeightMatch ? parseInt(netWeightMatch[1], 10) : null;


        redisClient.get('BROCCOLI:DEVICES:' + thingName, function (err, result) {
            if (err) {
                console.log('Error: ', err);
                return;
            }
            console.log('Result: ', result);
            const device = JSON.parse(result);
            const project = device.PROJS
            const formattedThingName = device.NAME.replace('ZT', 'ZebraTail-').replace(/_/g, '_');
            console.log(formattedThingName)
const url = `https://${project}.produceflow.com/ztweight.php?device=${Mobj.thingName}&grossWeight=${grossWeight}`;
console.log(url)
             request(url, function (error, response, body) {
                 if (!error && response.statusCode == 200) {
                    console.log('flag 1')
                     const obj = {
                         type: 'printTag',
                         thingName: thingName,
                         zpl: body.split('/r/n').join('')
                     };
                     //console.log(response)
                 } else {
                    console.log('flag 2')
                     console.log('error: ', error);
                     weightLogger.error('error: ', error);
                     // If there's an error, you might still want to try the next request or retry the current one based on your logic
                 }
             });
            setTimeout(listenForWeight,200)
        });
    });
}

function processRequests(index, max, thingName, project, counter,reading) {
    const url = `https://${project}.produceflow.com/ztweight.php?device=${thingName}&counter=${counter}&reading=${reading}`;
    console.log('url: ', url);
    // log url
    weightLogger.info('url: ', url,thingName,project,counter);
    /*
    request(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            const obj = {
                type: 'printTag',
                thingName: thingName,
                zpl: body.split('/r/n').join('')
            };
            handleIncomingJob(thingName, JSON.stringify(obj))
                .then(() => {
                    console.log('Job processed:', obj.thingName);
                    weightLogger.info('Job processed:', obj);
                    processRequests(index + 1, max, thingName, project, counter,obj.reading); // Call recursively after promise resolves
                });
        } else {
            console.log('error: ', error);
            weightLogger.error('error: ', error);
            // If there's an error, you might still want to try the next request or retry the current one based on your logic
            processRequests(index + 1, max, thingName, project, counter,reading);
        }
    });
    */
}

function handleIncomingJob(printerId, data) {
    return new Promise((resolve) => {
        setTimeout(() => {
            enqueueJob(printerId, data)
                .then(resolve) // Properly pass resolve as a function reference
                .catch(error => {
                    console.error('Failed to enqueue job:', error);
                    // Handle error or reject if necessary
                });
        }, 50);
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
console.log('listen for weight')
listenForWeight();

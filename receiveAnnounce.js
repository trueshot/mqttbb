const ULID = require('ulid')
const ulid = ULID.monotonicFactory()
const bb = require("./lib/barebones");
const { executeAll, JsonSubscription, QoS, Echo, sendOne } = require("./lib/pubsub");
const EVENT_EXPIRY = 24 * 60 * 60; // 24 hours in seconds
var client1 = require('redis').createClient({
   host:'54.173.45.122',
   port:'6379',
   password:'e2c7dd14d6961',
   legacyMode: true
});
process.on("exit", function () {
   client1.quit()
})

// create logger nodejs log4js
var log4js = require('log4js');
log4js.configure({
    appenders: {
        // Define info file appenders
        heartbeatInfo: { type: 'file', filename: 'heartbeat-info.log' },
        bootInfo: { type: 'file', filename: 'boot-info.log' },
        buttonInfo: { type: 'file', filename: 'button-info.log' },
        initializeInfo: { type: 'file', filename: 'initialize-info.log' },

        // Define error file appenders
        heartbeatError: { type: 'file', filename: 'heartbeat-error.log' },
        bootError: { type: 'file', filename: 'boot-error.log' },
        buttonError: { type: 'file', filename: 'button-error.log' },
        initializeError: { type: 'file', filename: 'initialize-error.log' },

        // Filters for info logs
        filterHeartbeatInfo: { type: 'logLevelFilter', appender: 'heartbeatInfo', level: 'info', maxLevel: 'info' },
        filterBootInfo: { type: 'logLevelFilter', appender: 'bootInfo', level: 'info', maxLevel: 'info' },
        filterButtonInfo: { type: 'logLevelFilter', appender: 'buttonInfo', level: 'info', maxLevel: 'info' },
        filterInitializeInfo: { type: 'logLevelFilter', appender: 'initializeInfo', level: 'info', maxLevel: 'info' },

        // Filters for error logs
        filterHeartbeatError: { type: 'logLevelFilter', appender: 'heartbeatError', level: 'error' },
        filterBootError: { type: 'logLevelFilter', appender: 'bootError', level: 'error' },
        filterButtonError: { type: 'logLevelFilter', appender: 'buttonError', level: 'error' },
        filterInitializeError: { type: 'logLevelFilter', appender: 'initializeError', level: 'error' }
    },
    categories: {
        default: { appenders: ['filterHeartbeatInfo', 'filterHeartbeatError'], level: 'info' },
        heartbeat: { appenders: ['filterHeartbeatInfo', 'filterHeartbeatError'], level: 'info' },
        boot: { appenders: ['filterBootInfo', 'filterBootError'], level: 'info' },
        button: { appenders: ['filterButtonInfo', 'filterButtonError'], level: 'info' },
        initialize: { appenders: ['filterInitializeInfo', 'filterInitializeError'], level: 'info' }
    }
});

var heartbeatLogger = log4js.getLogger('heartbeat');
var bootLogger = log4js.getLogger('boot');
var buttonLogger = log4js.getLogger('button');
var initializeLogger = log4js.getLogger('initialize');

// Example usage
heartbeatLogger.info('Heartbeat activity detected');
heartbeatLogger.error('Error with heartbeat process');
bootLogger.info('System booting up');
bootLogger.error('Error during system boot');


var heartbeatLogger = log4js.getLogger('heartbeat');
var bootLogger = log4js.getLogger('boot');
var buttonLogger = log4js.getLogger('button');
var initializeLogger = log4js.getLogger('initialize');

const args = {
  topic: "ZebraTail/chat",
  message: "por qué no los dos",
  count: 2,
};
var ZTobj = {}
var ZTtoLookUp = []

const storeEvent = (json) => {
    if (!json.ulid) return; 
    
    const timelineKey = 'events:timeline';
    const transactKey = `events:transacts:${json.ulid}`;
    
    // Add to timeline sorted set with score as timestamp
    client1.zadd(timelineKey, Date.now(), json.ulid);
    
    // Add to transaction sequence
    client1.rpush(transactKey, JSON.stringify({
        timestamp: Date.now(),
        type: json.type,
        thingName: json.thingName,
        data: json
    }));
    
    // Set expiry on the transaction sequence
    client1.expire(transactKey, EVENT_EXPIRY);
    
    // Cleanup old timeline entries
    client1.zremrangebyscore(timelineKey, 0, Date.now() - (EVENT_EXPIRY * 1000));
}
async function main(argv) {
  const connection = await bb.connect();
  let lastTime = 0;
  
  const messageHandler = (json, topic, dup, qos, retain) => {
    lastTime = Date.now();
    try {
      if (json.type === 'initialize') {
        json.ulid = ulid()
        storeEvent(json)
        client1.rpush('TagsToPrint',JSON.stringify(json))
        console.log('Initialize', "initialized")
        initializeLogger.info(JSON.stringify(json))
      } else if (json.type === 'heartbeat') {
        console.log('.......',showProj(json.thingName),'..',json.thingName,json['wifi-rssi-low'],bg.White,new Date(), "\x1b[0m")
        heartbeatLogger.info('.......',showProj(json.thingName),'..',json.thingName,json['wifi-rssi-low'], "\x1b[0m")
      } else if (json.type === 'boot') {
        json.ulid = ulid()
        storeEvent(json)
        var thingName = json.thingName.replace('ZebraTail-', 'ZT').replace(/_/g, '');
        var longThingName = json.thingName
        console.log(bg.Cyan, fg.Black, 'boot', "\x1b[0m",thingName,json.mac);
        bootLogger.info(bg.Cyan, fg.Black, 'boot', "\x1b[0m",thingName,json.mac);
        client1.get('BROCCOLI:DEVICES:'+thingName,function(err,theThing) {
          theThing = JSON.parse(theThing)
          if (theThing) {
            if (theThing.TEMPLATE) {
              console.log('-------',theThing.PROJS,theThing.NAME,'found. pushing.zpl to printer')
              bootLogger.info('-------',theThing.PROJS,theThing.NAME,'found. pushing.zpl to printer')
              ZTobj[theThing.NAME] = theThing
              for (var i = 0; i<theThing.TEMPLATE.length;i++) {
                theThing.zpl = theThing.TEMPLATE[i]
                theThing.thingName = thingName
                console.log(longThingName)
                var newObj =  {
                  "type": "printTag",
                  "thingName": longThingName,
                  "zpl": theThing.zpl
                }
                client1.rpush('TagsToPrint',JSON.stringify(newObj))
                bootLogger.info('TagsToPrint',JSON.stringify(newObj))
              }
            }
          } else {
            console.log('unknown thing:'+thingName)
            bootLogger.info('unknown thing:'+thingName)
          }
        })
      } else if (json.type === 'button' || json.type === 'scale') {
        json.ulid = ulid()
        storeEvent(json)
        if (json.type === 'button') {
          console.log(bg.Blue,fg.Green, 'button',bg.Black,fg.Yellow,showProj(json.thingName),json.thingName,new Date(), "\x1b[0m");
          buttonLogger.info(bg.Blue,fg.Green, 'button',bg.Black,fg.Yellow,showProj(json.thingName),json.thingName,new Date(), "\x1b[0m");
           if (ZTobj[json.thingName] && ZTobj[json.thingName]['ZTNAME']) {
             json.zt = ZTobj[json.thingName]['ZTNAME'];
             console.log('woot')
           }
          client1.rpush('ButtonPushed',JSON.stringify(json))
        }
        if (json.type === 'scale') {
          console.log(bg.Blue,fg.Green, 'scale',bg.Black,fg.Yellow,showProj(json.thingName),json.thingName,new Date(), "\x1b[0m");
          buttonLogger.info(bg.Blue,fg.Green, 'scale',bg.Black,fg.Yellow,showProj(json.thingName),json.thingName,new Date(), "\x1b[0m");
          client1.rpush('WeightPushed',JSON.stringify(json))
        }
      }
    } catch (x) {
      console.error("rpush", x)
    }
  };
// Add this right after the messageHandler definition
// This will trigger the initialization immediately when the program starts
const initPayload = {
  "type": "initialize",
  "free-heap": 214904,
  "thingName": "ZebraTail-5E_9C_D4"
};
messageHandler(initPayload, "ZebraTail/announce", false, 0, false);
  const sub = new JsonSubscription("ZebraTail/announce", messageHandler);

  setTimeout(function() {
    messageHandler({
      type: "button",
      thingName: "ZebraTail-5E_AB_C0"
    }, "ZebraTail/announce", false, 0, false);
  }, 65000);   

  let lastLast = 0;
  setInterval(() => {
    if (lastLast < lastTime) {
      lastLast = lastTime
      return
    }
    console.log(new Date(), "no heartbeat?")
  }, 63 * 1000)
  
  await sub.execute(connection);
  await bb.disconnect(connection);
}
var showProj = function(zt) {
   if (ZTobj.hasOwnProperty(zt)) {
      if (ZTobj[zt]['ZTNAME']) {
         return ZTobj[zt].PROJS+'('+ZTobj[zt]['ZTNAME']+')'
      } else {
         return ZTobj[zt].PROJS
      }
   } else {
      lookUpZT(zt)
      return "pending..."
   }
}
var lookUpZT = function(zt) {
   var thingName = zt.replace('ZebraTail-', 'ZT').replace(/_/g, '');
   var theThing
   client1.get('BROCCOLI:DEVICES:'+thingName,function(err,theThing) {
      theThing = JSON.parse(theThing)
      if (theThing) {
         ZTobj[theThing.NAME] = theThing
      } else {
         console.log('unknown thing:'+zt)
      }
   })
}
main(args);

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



/*
console.log(bg.White,fg.Black, 'fg.Black', "\x1b[0m");
console.log(bg.White,fg.Red, 'fg.Red', "\x1b[0m");
console.log(bg.White,fg.Blue, 'fg.Blue', "\x1b[0m");
console.log(bg.White,fg.Magenta, 'fg.Magenta', "\x1b[0m");

console.log(fg.Cyan, 'fg.Cyan', "\x1b[0m");
console.log(fg.White, 'fg.White', "\x1b[0m");
console.log(fg.Green, 'fg.Green', "\x1b[0m");
console.log(fg.Yellow, 'fg.Yellow', "\x1b[0m");

console.log(fg.Red, 'This text is red', fg.Green, 'and this text is green.');
console.log(bg.Cyan, fg.Black, 'This text has a cyan background and black text!', "\x1b[0m");
console.log('This text is back to default colors.');
*/



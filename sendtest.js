// File: pushInit.js
const ULID = require('ulid');
const ulid = ULID.monotonicFactory();
const log4js = require('log4js');

// Configure Redis
const redis = require('redis').createClient({
   host:'54.173.45.122',
   port:'6379',
   password:'e2c7dd14d6961',
   legacyMode: true
});

// Configure logger
log4js.configure({
    appenders: {
        initializeInfo: { type: 'file', filename: 'initialize-info.log' },
        filterInitializeInfo: { type: 'logLevelFilter', appender: 'initializeInfo', level: 'info', maxLevel: 'info' }
    },
    categories: {
        initialize: { appenders: ['filterInitializeInfo'], level: 'info' }
    }
});
const initializeLogger = log4js.getLogger('initialize');

// Create the payload
const initPayload = {
  "type": "initialize",
  "free-heap": 214904,
  "thingName": "ZebraTail-5E_9C_D4",
  "ulid": ulid()
};

// Store event function
const storeEvent = (json) => {
    const timelineKey = 'events:timeline';
    const transactKey = `events:transacts:${json.ulid}`;
    
    // Add to timeline sorted set with score as timestamp
    redis.zadd(timelineKey, Date.now(), json.ulid);
    
    // Add to transaction sequence
    redis.rpush(transactKey, JSON.stringify({
        timestamp: Date.now(),
        type: json.type,
        thingName: json.thingName,
        data: json
    }));
    
    // Set expiry on the transaction sequence
    redis.expire(transactKey, 24 * 60 * 60);
};

// Process the initialization
console.log('Processing initialization for:', initPayload.thingName);

// Store event in Redis
storeEvent(initPayload);

// Push to TagsToPrint queue
redis.rpush('TagsToPrint', JSON.stringify(initPayload));

// Log the event
console.log('Initialize', "initialized");
initializeLogger.info(JSON.stringify(initPayload));

// Give Redis operations time to complete
setTimeout(() => {
    redis.quit();
    console.log('Done. Redis connection closed.');
    process.exit(0);
}, 1000);
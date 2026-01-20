const redis = require('redis');
const log4js = require('log4js');

// Configure Redis client
const redisClient = redis.createClient({
    host: '54.173.45.122',
    port: '6379',
    password: 'e2c7dd14d6961',
    legacyMode: true
});

// Configure logging
log4js.configure({
    appenders: {
        infoFile: { type: 'file', filename: 'add-devices-info.log' },
        errorFile: { type: 'file', filename: 'add-devices-error.log' },
        info: {
            type: 'logLevelFilter',
            appender: 'infoFile',
            level: 'info',
            maxLevel: 'info'
        },
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

const logger = log4js.getLogger();

// Device MAC addresses in order
const devices = [
    '54:DD:08',
    '5E:B3:94',
    '5E:B8:E4',
    '5E:A8:38',
    '5E:AD:B4',
    '5E:94:40',
    '5E:A6:AC',
    '5E:9C:D4',
    '5E:AB:B4'
];

// Template for the ZPL code
const zplTemplate = '^XA^PW812^DFR:SAMPLE.GRF^FS^PW812^FO40,60^A0N,100,70^FN4^FS(desc)^FO40,160^A0N,60,60^FN10^FS(desc2)^FO620,160^A0N,50,50^FDPLU:^FS^FO620,210^A0N,90,90^FN23^FS(PLU Code)^FO40,210^AUN,59,53^FDLot No:^FS^FO190,210^A0N,59,53^FN1^FS(Lot No)^FO80,270^BY3^BUN,100^FN27^FS(barcode-UPC)^FO40,420^ASN,40,35^FDQty:^FS^FO140,420^ASN,40,35^FN5:^FS^FO40,480^ASN,40,35^FDTag No:^FS^FO50,530^A0N,70,90^FN7^FS(Tag_id)^FO426,283.75^GB406,152.25,2^FS(daughter tag1 box)^FO720,300^A0N,20,25^FN6^FS(item_no)^FO460,300^A0N,30,35^FN1^FS(lot_no)^FO460,325^BY3,2.4^B3N,,70^FN7^FS(barcode)^FO426,436^GB406,152.25,2^FS(daughter tag2 box)^FO720,450^A0N,20,25^FN6^FS(item_no)^FO460,450^A0N,30,35^FN1^FS(lot_no)^FO460,475^BY3,2.4^B3N,,70^FN7^FS(barcode)^FO40,605^BY2,2^BCN,80,Y,N,,D^FN24^FS(GTIN barcode)^FO640,610^AQN,28,24^FDDistributed by:^FS^FO640,640^ARN,35,31^FDWillis Produce^FS^FO640,680^ARN,35,41^FDLodge, SC^FS^FO60,730^A0N,50,60^FDProducta of^FS^FO360,730^A0N,50,60^FN19^FS^FO60,780^A0N,50,60^FDWatermelon^FS^FO460,780^A0N,60,60^FN3^FS(Warehouse)^FO620,740^GB200,95,95,,^FS(Box for voicepick)^FO635,785^CF0,60,60^FR^FN25^FS (Voicepick 1)^FO695,748^CF0,110,130^FR^FN26^FS (Voicepick 2)^FO4000,4000^A0n,1,1^FN1^FS(offscreen)^FO4000,4000^A0n,1,1^FN2^FS(offscreen)^FO4000,4000^A0n,1,1^FN3^FS(offscreen)^FO4000,4000^A0n,1,1^FN4^FS(offscreen)^FO4000,4000^A0n,1,1^FN5^FS(offscreen)^FO4000,4000^A0n,1,1^FN6^FS(offscreen)^FO4000,4000^A0n,1,1^FN7^FS(offscreen)^FO4000,4000^A0n,1,1^FN8^FS(offscreen)^FO4000,4000^A0n,1,1^FN9^FS(offscreen)^FO4000,4000^A0n,1,1^FN10^FS(offscreen)^FO4000,4000^A0n,1,1^FN11^FS(offscreen)^FO4000,4000^A0n,1,1^FN12^FS(offscreen)^FO4000,4000^A0n,1,1^FN13^FS(offscreen)^FO4000,4000^A0n,1,1^FN14^FS(offscreen)^FO4000,4000^A0n,1,1^FN15^FS(offscreen)^FO4000,4000^A0n,1,1^FN16^FS(offscreen)^FO4000,4000^A0n,1,1^FN17^FS(offscreen)^FO4000,4000^A0n,1,1^FN18^FS(offscreen)^FO4000,4000^A0n,1,1^FN19^FS(offscreen)^FO4000,4000^A0n,1,1^FN20^FS(offscreen)^FO4000,4000^A0n,1,1^FN21^FS(offscreen)^FO4000,4000^A0n,1,1^FN22^FS(offscreen)^FO4000,4000^A0n,1,1^FN23^FS(offscreen)^FO4000,4000^A0n,1,1^FN24^FS(offscreen)^FO4000,4000^A0n,1,1^FN25^FS(offscreen)^FO4000,4000^A0n,1,1^FN26^FS(offscreen)^FO4000,4000^A0n,1,1^FN27^FS(offscreen)^FO4000,4000^A0n,1,1^FN28^FS(offscreen)^FO4000,4000^A0n,1,1^FN29^FS(offscreen)^FO4000,4000^A0n,1,1^FN30^FS(offscreen)^FO4000,4000^A0n,1,1^FN31^FS(offscreen)^FO4000,4000^A0n,1,1^FN32^FS(offscreen)^FO4000,4000^A0n,1,1^FN33^FS(offscreen)^XZ';

// Function to add a device to Redis
function addDevice(mac, index) {
    const deviceData = {
        TYPE: "ZEBRATAIL",
        PROJS: "willis",
        NAME: `ZebraTail-${mac.replace(/:/g, '_')}`,
        BUTTONQTY: 1,
        ZTNAME: index < 9 ? `ZT${index + 1}` : 'ZT',
        TEMPLATE: [zplTemplate]
    };

    const redisKey = `BROCCOLI:DEVICES:ZT${mac.replace(/:/g, '')}`;
    
    redisClient.set(redisKey, JSON.stringify(deviceData), (err, reply) => {
        if (err) {
            console.error(`Error adding device ${mac}:`, err);
            logger.error(`Error adding device ${mac}:`, err);
            return;
        }
        console.log(`Added device ${mac} as ${deviceData.ZTNAME}`);
        logger.info(`Added device ${mac} as ${deviceData.ZTNAME}`);
    });
}

// Add all devices
redisClient.on('connect', () => {
    console.log('Connected to Redis');
    logger.info('Connected to Redis');
    
    devices.forEach((mac, index) => {
        addDevice(mac, index);
    });

    // Wait a bit to ensure all devices are added before closing
    setTimeout(() => {
        console.log('Completed adding devices');
        logger.info('Completed adding devices');
        redisClient.quit();
        process.exit(0);
    }, 2000);
});

redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
    logger.error('Redis Client Error:', err);
    process.exit(1);
});
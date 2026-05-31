// zsprinter.js — ZebraSlayer print/layout publisher  (THE BULKHEAD consumer)
// Author: taghkanic gen-9  2026-05-31
//
// PURPOSE / WHY THIS IS A SEPARATE FILE:
//   This is the new ZebraSlayer (Dazzle Tab5) delivery process. It is deliberately
//   ISOLATED from the legacy tagprinter.js. The bulkhead = three separations so a fault
//   in the new ZS path cannot disconnect or crash-loop the legacy printing Willis
//   production runs on (the 2026-05-30 outage):
//     1. SEPARATE FILE/PROCESS  — legacy tagprinter.js is untouched.
//     2. SEPARATE QUEUE         — this drains 'ZSToPrint'; legacy drains 'TagsToPrint'.
//     3. SEPARATE CERT          — uses keys-zsprinter/ (ZS_Wrangler), whose IoT policy
//        permits ZebraTail-*/direct/print AND /direct/layout. The legacy cert does NOT
//        permit /direct/layout — which is exactly what crashed legacy when a layout job
//        went through it. This process only ever publishes to /direct/print or
//        /direct/layout (both policy-allowed), so it cannot trip the forbidden-publish
//        disconnect.
//
// JOB SHAPES on ZSToPrint (RPUSHed by truemq i_zs.js once repointed off TagsToPrint):
//   {type:'printTag', thingName, zpl}    -> publish zpl    to {thingName}/direct/print
//   {type:'layout',   thingName, layout} -> publish layout to {thingName}/direct/layout
//
// HARDENING (so it doesn't even flood its own compartment):
//   - per-job try/catch: a malformed/unknown/failed job is SKIPPED, never kills the loop.
//   - unknown type -> skip (never publish to a non-allowed topic).
//   - barebones still process.exit's on a real disconnect; that's acceptable here because
//     we only publish allowed topics (no policy-disconnect), so a restart can't poison-loop.
//
// IDENTITY: the ZS_Wrangler policy only allows connect as client ZebraWrangler / ZebraWrangler-*.
//   barebones builds client_id = CLIENT_ID + "-" + <scriptname> = CLIENT_ID + "-zsprinter".
//   So CLIENT_ID must be "ZebraWrangler" for THIS process. Force it before barebones loads
//   dotenv (dotenv does not override an already-set env var); other scripts keep their own.
process.env.CLIENT_ID = 'ZebraWrangler';

const redis = require('redis');
const iotsdk = require('aws-iot-device-sdk-v2');
const mqtt = iotsdk.mqtt;
const bb = require('./lib/barebones');   // auto-discovers keys-zsprinter/ from the script name

const QUEUE = 'ZSToPrint';

// Eagle (same Redis the legacy path uses, different queue) — matches tagprinter.js.
const redisClient = redis.createClient({
  host: '54.173.45.122',
  port: '6379',
  password: 'e2c7dd14d6961',
  legacyMode: true
});
redisClient.on('error', (e) => console.log('[zsprinter] Redis error:', e && e.message));

let mqttConnection = null;
function ensureConnected() {
  if (mqttConnection) return Promise.resolve(mqttConnection);
  return bb.connect().then((c) => { mqttConnection = c; return c; });
}

// Map job -> topic. Returns null for anything we are NOT permitted to publish (so we skip
// rather than ever publishing to a non-allowed topic).
function topicFor(job) {
  if (job.type === 'layout')   return job.thingName + '/direct/layout';
  if (job.type === 'printTag') return job.thingName + '/direct/print';
  return null;
}
function payloadFor(job) {
  if (job.type === 'layout') {
    return (typeof job.layout === 'string') ? job.layout : JSON.stringify(job.layout);
  }
  return job.zpl;   // printTag: raw ZPL
}

function watch() {
  redisClient.blpop(QUEUE, 0, (err, result) => {
    if (err) { console.log('[zsprinter] blpop error:', err); return setImmediate(watch); }
    if (!result) return setImmediate(watch);

    let job;
    try { job = JSON.parse(result[1]); }
    catch (e) { console.log('[zsprinter] bad JSON, skipping:', e.message); return setImmediate(watch); }

    const topic = topicFor(job);
    if (!topic) { console.log('[zsprinter] unknown/forbidden type, skipping:', job && job.type); return setImmediate(watch); }
    const payload = payloadFor(job);
    if (!job.thingName || payload == null) { console.log('[zsprinter] missing thingName/payload, skipping'); return setImmediate(watch); }

    ensureConnected()
      .then((c) => c.publish(topic, payload, mqtt.QoS.AtLeastOnce))
      .then(() => { console.log('[zsprinter] published ' + job.type + ' -> ' + topic + '  (' + String(payload).length + ' B)'); })
      .catch((e) => { console.log('[zsprinter] publish failed (skipping):', e && e.message); })
      .then(() => setImmediate(watch));   // ALWAYS keep draining, success or fail
  });
}

process.on('SIGINT', () => { try { redisClient.quit(); } catch (e) {} process.exit(0); });

console.log('[zsprinter] draining ' + QUEUE + ' -> {thingName}/direct/{print|layout}  (ZS_Wrangler cert; bulkhead, legacy untouched)');
watch();

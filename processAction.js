// processAction.js — ZebraSlayer tap consumer  (ActionPushed -> willis fastzs.php -> i_fasttag_heavy)
// Author: taghkanic gen-12  2026-06-09
//
// THE MISSING LINK in the ZS create-and-print chain (MEP "3 Phases" tab, Goal 1):
//
//   Tab5 tap -> ZebraTail/announce -> receiveAnnounce.js -> Eagle ActionPushed
//     -> THIS PROCESS (BLPOP) -> GET <base>/fastzs.php?item=<action>&zs=<zt>
//     -> fastzs.php: exec i_fasttag_heavy <item> <zs>   (spal R [PAL=AprilTag] + T + tag2prnt COMPUTER=zsN)
//                    exec upitail <lot>                  (per-load tordtail -> master ordtail)
//     -> mp.bat / i_maxpnew renders + splices 48h12_<PAL>.zpl -> prnttagzs* -> device
//
// This is a TRIGGER BRIDGE only: no ZPL, no DBF access, no MQTT publish. All heavy lifting
// is server-side on Hawk. Runs on MONKEY (new path). Separate process per the bulkhead rule
// (a fault here can never touch legacy tagprinter or the zsprinter delivery bulkhead).
//
// NOT the same thing as zsprinter.js — zsprinter is Phase-3 DELIVERY (ZSToPrint -> MQTT).
// This is Phase-1 TRIGGER consumption (ActionPushed -> create call). Different ends of the chain.
//
// Job shape on ActionPushed (receiveAnnounce routes button announces that carry an action):
//   {"type":"button","label":"60ct Seedless","action":"1060","counter":1,
//    "thingName":"ZebraTail-96_4D_00","zt":"zs4","ulid":"01KT..."}
//
// HARDENING:
//   - per-job try/catch: malformed/unknown jobs are logged + skipped; the loop ALWAYS re-arms.
//   - ulid dedup (SETEX 10 min): MQTT QoS1 is at-least-once — a duplicate delivery would
//     otherwise birth a DUPLICATE PALLET. Dedup makes the create idempotent per tap.
//   - station allowlist: only zs1-zs4 may create. zs5 = Ken Chan's dev device -> skipped.
//   - failed HTTP -> log the full job JSON (for manual replay) and DROP. No auto-retry:
//     a poison-job retry loop is exactly what backed production up before. A worker re-taps.

const redis = require('redis');
const request = require('request');
const log4js = require('log4js');

// ---- config (data, not code) ------------------------------------------------
const QUEUE = 'ActionPushed';
// n2ag.com = the DIRECT route to the prey webroot (basic auth). Do NOT use
// <dataset>.produceflow.com here — that's the public gateway + SSO, whose
// redirect kills server-to-server calls (the triplek ERR_UNSAFE_REDIRECT lesson).
const PHP_BASE = process.env.ZS_PHP_BASE || 'http://n2ag.com/willis';
const PHP_PATH = '/fastzs.php';
const PHP_AUTH = { user: 'george', pass: 'matt' };
const STATIONS = { zs1: true, zs2: true, zs3: true, zs4: true };   // zs5 = Ken Chan dev: not listed
const DEDUP_TTL = 600;                                              // seconds
// -----------------------------------------------------------------------------

log4js.configure({
  appenders: {
    infoFile:  { type: 'file', filename: 'processAction-info.log' },
    errorFile: { type: 'file', filename: 'processAction-error.log' },
    info:  { type: 'logLevelFilter', appender: 'infoFile',  level: 'info', maxLevel: 'info' },
    error: { type: 'logLevelFilter', appender: 'errorFile', level: 'error' }
  },
  categories: { default: { appenders: ['info', 'error'], level: 'info' } }
});
const logger = log4js.getLogger('processAction');

// Eagle — same instance/config as receiveAnnounce/zsprinter, different queue.
const redisClient = redis.createClient({
  host: '54.173.45.122',
  port: '6379',
  password: 'e2c7dd14d6961',
  legacyMode: true
});
redisClient.on('error', (e) => console.log('[processAction] Redis error:', e && e.message));

// Normalize "ZebraTail-96_4D_00" -> "ZT964D00" (the BROCCOLI:DEVICES key form).
function normalize(thingName) {
  return String(thingName || '').replace('ZebraTail-', 'ZT').replace(/_/g, '');
}

// Resolve the station (zs#) for a job: prefer job.zt (receiveAnnounce stamps it from its
// cache); fall back to BROCCOLI:DEVICES:<norm>.ZTNAME when the cache was cold.
function resolveStation(job, cb) {
  if (job.zt) return cb(null, String(job.zt).toLowerCase());
  redisClient.get('BROCCOLI:DEVICES:' + normalize(job.thingName), (err, raw) => {
    if (err || !raw) return cb(err || new Error('no BROCCOLI:DEVICES record'), null);
    let dev;
    try { dev = JSON.parse(raw); } catch (e) { return cb(e, null); }
    if (!dev || !dev.ZTNAME) return cb(new Error('device record has no ZTNAME'), null);
    cb(null, String(dev.ZTNAME).toLowerCase());
  });
}

function fireCreate(job, station, done) {
  const url = PHP_BASE + PHP_PATH + '?item=' + encodeURIComponent(job.action) +
              '&zs=' + encodeURIComponent(station);
  console.log('[processAction] tap ' + job.thingName + ' (' + station + ') item=' + job.action +
              ' "' + (job.label || '') + '" -> ' + url);
  logger.info('create', station, job.action, job.label || '', job.ulid || '', url);

  request({ url: url, auth: PHP_AUTH, timeout: 60000 }, (error, response, body) => {
    if (error || !response || response.statusCode !== 200) {
      console.log('[processAction] create FAILED (job dropped, replay manually):',
                  error ? error.message : 'HTTP ' + (response && response.statusCode));
      logger.error('create failed; job for manual replay:', JSON.stringify(job),
                   error ? String(error.message) : 'HTTP ' + (response && response.statusCode));
      return done();
    }
    const summary = String(body || '').slice(0, 200);
    console.log('[processAction] ' + station + ' item=' + job.action + ' -> ' + summary);
    // Success is ONLY a body starting with OK. An SSO/login page or any other
    // HTML comes back as HTTP 200 too — that is a FAILURE (learned 2026-06-10
    // when the gateway's sign-in page got logged as "created").
    if (summary.indexOf('OK') === 0) {
      logger.info('created:', summary);
    } else {
      logger.error('fastzs did not return OK; job for manual replay:', JSON.stringify(job), 'response:', summary);
    }
    done();
  });
}

function watch() {
  redisClient.blpop(QUEUE, 0, (err, result) => {
    if (err) { console.log('[processAction] blpop error:', err && err.message); return setTimeout(watch, 2000); }
    if (!result) return setImmediate(watch);

    let job;
    try { job = JSON.parse(result[1]); }
    catch (e) { console.log('[processAction] bad JSON, skipping:', e.message); return setImmediate(watch); }

    if (!job || !job.action || !job.thingName) {
      console.log('[processAction] missing action/thingName, skipping');
      logger.error('missing action/thingName, skipped:', result[1]);
      return setImmediate(watch);
    }

    // dedup by ulid (idempotent create per tap)
    const dedupKey = 'dedup:action:' + (job.ulid || (job.thingName + ':' + job.action + ':' + job.counter));
    redisClient.set(dedupKey, '1', 'EX', DEDUP_TTL, 'NX', (derr, reply) => {
      if (!derr && reply === null) {
        console.log('[processAction] duplicate tap (ulid seen), skipping:', job.ulid);
        logger.info('duplicate skipped:', job.ulid);
        return setImmediate(watch);
      }
      resolveStation(job, (serr, station) => {
        if (serr || !station) {
          console.log('[processAction] cannot resolve station, skipping:', serr && serr.message);
          logger.error('station unresolved, skipped:', JSON.stringify(job));
          return setImmediate(watch);
        }
        if (!STATIONS[station]) {
          console.log('[processAction] station ' + station + ' not in allowlist (dev device?), skipping');
          logger.info('non-production station skipped:', station, job.thingName);
          return setImmediate(watch);
        }
        fireCreate(job, station, () => setImmediate(watch));
      });
    });
  });
}

process.on('SIGINT', () => { try { redisClient.quit(); } catch (e) {} process.exit(0); });

console.log('[processAction] draining ' + QUEUE + ' -> ' + PHP_BASE + PHP_PATH +
            '  (stations: ' + Object.keys(STATIONS).join(',') + ')');
watch();

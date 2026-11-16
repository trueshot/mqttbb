// tt2bridge.js — prints for LINKED TrueTag2 stations: Frog <ds>:printer:<N>  ->  MQTT <thing>/direct
// Author: taghkanic gen-19, 2026-11-16. George's go 11-16 (to cirrus1): "I want to move forward with this."
//
// A linked TrueTag2 station has its own AWS IoT thing (TT2-<dataset>-<deviceId>) and NO Frog password, so it
// cannot BLPOP Frog. This bridge does it for the station and hands each label over MQTT.
//
// CONTRACT with tangelopark (dm 2026-11-16 14:46Z):
//   job     -> <thing>/direct   QoS1  {id, slot, zpl}        (< 128 KB; the template is already prepended here)
//   status  <- <thing>/status   QoS1  {type:'status', state, slots:{'1':{state, printer}}, version, at}
//              sent on connect, on change and every 60 s
//   result  <- <thing>/result   QoS1  {id, slot, result:'printed'|'failed'|'rejected', error, at}
//   presence<- $aws/events/presence/connected|disconnected/<thing>
//   Which stations exist: mobile's D:/datasets/<ds>/devices.db, table device, kind TRUETAG2, status active.
//
// RULES
//   - Pop a slot ONLY while its station is connected, sent a status in the last 90 s, is 'ready' and shows that
//     slot 'ready'. Otherwise the job WAITS in Frog (Frog is the buffer; MQTT holds QoS1 only ~1 h).
//   - One slot = one consumer. Two stations claiming one slot -> feed neither, log CONFLICT. A Frog-reading
//     TrueTag2 alive on the dataset (<ds>:tt2:alive:<host>, alpha.12+) -> leave the slots it reads alone.
//     (Pre-alpha.12 TrueTag2 writes no alive key: never enable a dataset here that still runs one.)
//   - The cert (D:/secrets/tt2bridge, policy TT2_Bridge) may publish ONLY TT2-*/direct. Any other publish =
//     broker disconnect = crash loop (2026-05-30). publishJob() refuses every other topic.
//   - Results go to <ds>:printer:<N>:trace in TrueTag2's shape, so tagstatus and the board read them unchanged.
//     failed/rejected -> the label also goes to <ds>:printer:<N>:dead. No result in 10 min -> trace 'no-result'.
//   - Separate process, cert, client id and Redis connections from tagprinter/zsprinter (bulkhead).
//
// RUN (Monkey, a coach tab):  node tt2bridge.js        env: TT2BRIDGE_DATASETS=willdev[,ds2]
//   Frog password: env TT2BRIDGE_FROG_PASSWORD or D:/secrets/tt2bridge/frog.txt (never in this file).
'use strict';
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CFG = {
  datasets: (process.env.TT2BRIDGE_DATASETS || 'willdev').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
  datasetsDir: process.env.TT2BRIDGE_DATASETS_DIR || 'D:/datasets',
  certDir: process.env.TT2BRIDGE_CERTS || 'D:/secrets/tt2bridge',
  endpoint: process.env.TT2BRIDGE_ENDPOINT || 'a1loev32pi8gr8-ats.iot.us-east-1.amazonaws.com',
  clientId: process.env.TT2BRIDGE_CLIENT_ID || 'TT2Bridge-' + os.hostname().toLowerCase().replace(/[^a-z0-9-]/g, ''),
  frogHost: process.env.TT2BRIDGE_FROG_HOST || '54.173.177.227',
  frogPort: +(process.env.TT2BRIDGE_FROG_PORT || 7721),
  statusFreshMs: 90 * 1000,
  devicesEveryMs: 60 * 1000,
  aliveEveryMs: 10 * 1000,
  resultWaitMs: 10 * 60 * 1000,
  blpopSec: 5,
  maxPayload: 120 * 1024,
};

const THING_RE = /^TT2-[A-Za-z0-9_-]+$/;
const log = (...a) => console.log(new Date().toISOString(), '[tt2bridge]', ...a);

// ------------------------------------------------------------------ pure logic (tested)
// Which Frog keys to feed, and to which thing. stations: [{ds, thing, connected, statusAt, status}]
// aliveClaims: {ds: Set(slot) | 'ALL'}  ->  {feed: Map(key -> thing), conflicts: [text]}
function feedPlan(datasets, stations, aliveClaims, now, freshMs) {
  const feed = new Map(); const conflicts = [];
  for (const ds of datasets) {
    const claims = {}; // slot -> [thing]
    for (const s of stations) {
      if (s.ds !== ds || s.connected === false || !s.status || now - s.statusAt > freshMs) continue;
      if (s.status.state !== 'ready') continue;
      for (const [slot, info] of Object.entries(s.status.slots || {})) {
        if (!/^\d+$/.test(slot) || !info || info.state !== 'ready') continue;
        (claims[slot] = claims[slot] || []).push(s.thing);
      }
    }
    const alive = aliveClaims[ds];
    for (const [slot, things] of Object.entries(claims)) {
      if (things.length > 1) { conflicts.push(`${ds} slot ${slot} claimed by ${things.join(' + ')}: feeding neither`); continue; }
      if (alive === 'ALL' || (alive && alive.has(slot))) { conflicts.push(`${ds} slot ${slot}: a Frog-reading TrueTag2 is alive on it; leaving it to that station`); continue; }
      feed.set(`${ds}:printer:${slot}`, things[0]);
    }
  }
  return { feed, conflicts };
}

// The label exactly as a Frog-reading TrueTag2 would print it: a data-only job (no ^DF) gets the slot's template.
function buildLabel(zpl, template) {
  const selfContained = /\^DF/i.test(zpl);
  if (selfContained || !template) return { zpl, selfContained, templated: false };
  return { zpl: template + zpl, selfContained, templated: true };
}

// ------------------------------------------------------------------ the bridge (deps injected so it can be tested)
// deps: { cmd, block (redis 2.x clients), mqtt: {publish(topic, json) -> Promise, subscribe(topic, fn), unsubscribe(topic)},
//         listDevices(ds) -> [{deviceId, thing}] | null (null = could not read: keep what we have) }
function createBridge(deps, cfg = CFG) {
  const { cmd, block, mqtt, listDevices } = deps;
  const stations = new Map();   // thing -> {ds, deviceId, thing, connected, statusAt, status}
  const inflight = new Map();   // id -> {ds, key, slot, thing, zpl, at, selfContained, templated}
  let aliveClaims = {};
  let mqttUp = true, stopped = false, lastConflicts = '', backoffUntil = 0;
  const timers = [];
  const R = (fn, ...a) => new Promise((ok, bad) => cmd[fn](...a, (e, v) => e ? bad(e) : ok(v)));

  function onStatus(thing, msg) {
    const s = stations.get(thing); if (!s || !msg || msg.type !== 'status') return;
    s.status = msg; s.statusAt = Date.now(); if (s.connected == null) s.connected = true;
  }
  function onPresence(thing, connected) { const s = stations.get(thing); if (s) { s.connected = connected; if (!connected) s.status = null; } }
  async function onResult(thing, msg) {
    const j = msg && inflight.get(msg.id); if (!j || j.thing !== thing) return;
    inflight.delete(msg.id);
    const result = ['printed', 'failed', 'rejected'].includes(msg.result) ? msg.result : 'failed';
    await trace(j, result, msg.error || null);
    if (result !== 'printed') await R('rpush', j.key + ':dead', j.zpl).catch(e => log('dead-letter failed', e.message));
  }
  async function trace(j, result, error) {
    const row = { at: new Date().toISOString(), slot: j.slot, id: j.id, jobBytes: j.zpl.length, jobHead: j.zpl.slice(0, 200),
      selfContained: j.selfContained, template: j.templated ? j.key.replace(':printer:', ':printer:template:') : null,
      delivery: { kind: 'mqtt', label: 'mqtt:' + j.thing }, result, error, ms: Date.now() - j.at, via: 'tt2bridge' };
    try { await R('lpush', j.key + ':trace', JSON.stringify(row)); await R('ltrim', j.key + ':trace', 0, 99); }
    catch (e) { log('trace write failed', e.message); }
    log(result.toUpperCase(), j.key, '->', j.thing, 'id', j.id, error || '');
  }

  function topicsFor(thing) {
    return [[`${thing}/status`, m => onStatus(thing, m)], [`${thing}/result`, m => onResult(thing, m)],
      [`$aws/events/presence/connected/${thing}`, () => onPresence(thing, true)],
      [`$aws/events/presence/disconnected/${thing}`, () => onPresence(thing, false)]];
  }
  async function refreshDevices() {
    for (const ds of cfg.datasets) {
      let list; try { list = listDevices(ds); } catch (e) { log('devices.db read failed', ds, e.message); list = null; }
      if (!list) continue; // keep current subscriptions; fail closed only for NEW stations
      const want = new Map(list.filter(d => THING_RE.test(d.thing)).map(d => [d.thing, d]));
      for (const [thing, s] of stations) if (s.ds === ds && !want.has(thing)) {   // removed / replaced station: stop feeding it
        stations.delete(thing); for (const [t] of topicsFor(thing)) mqtt.unsubscribe(t); log('station gone:', thing);
      }
      for (const [thing, d] of want) if (!stations.has(thing)) {
        stations.set(thing, { ds, deviceId: d.deviceId, thing, connected: null, statusAt: 0, status: null });
        for (const [t, fn] of topicsFor(thing)) mqtt.subscribe(t, fn);
        log('station linked:', thing);
      }
    }
  }
  async function refreshAlive() {
    const next = {};
    for (const ds of cfg.datasets) {
      let cursor = '0';
      try {
        do {
          const [c, keys] = await R('scan', cursor, 'MATCH', `${ds}:tt2:alive:*`, 'COUNT', 500); cursor = c;
          for (const k of keys) {
            let v = null; try { v = JSON.parse(await R('get', k)); } catch (e) { v = null; }
            const slots = v && v.slots && typeof v.slots === 'object' ? Object.keys(v.slots) : null;
            if (!slots) next[ds] = 'ALL';
            else if (next[ds] !== 'ALL') { next[ds] = next[ds] || new Set(); slots.forEach(x => next[ds].add(String(x))); }
          }
        } while (cursor !== '0');
      } catch (e) { log('alive scan failed', ds, e.message); next[ds] = 'ALL'; }   // cannot tell -> stay off
    }
    aliveClaims = next;
    const plan = feedPlan(cfg.datasets, [...stations.values()], aliveClaims, Date.now(), cfg.statusFreshMs);
    const feeding = {}; for (const [k, t] of plan.feed) feeding[k] = t;
    for (const ds of cfg.datasets) {
      R('set', `${ds}:tt2bridge:alive`, JSON.stringify({ host: os.hostname(), at: new Date().toISOString(), feeding, conflicts: plan.conflicts }), 'EX', 30).catch(() => {});
    }
  }
  async function sweep() {
    const now = Date.now();
    for (const [id, j] of inflight) if (now - j.at > cfg.resultWaitMs) { inflight.delete(id); await trace(j, 'no-result', 'no result from station in ' + Math.round(cfg.resultWaitMs / 60000) + ' min'); }
  }

  async function handleJob(key, zpl, thing) {
    const slot = key.split(':printer:')[1];
    const s = stations.get(thing);
    const plan = feedPlan(cfg.datasets, [...stations.values()], aliveClaims, Date.now(), cfg.statusFreshMs);
    if (!mqttUp || Date.now() < backoffUntil || !s || plan.feed.get(key) !== thing) {        // station went away while we waited: put it back
      await R('lpush', key, zpl); log('station not ready any more, job back on', key); return;
    }
    let template = null;
    if (!/\^DF/i.test(zpl)) template = await R('get', key.replace(':printer:', ':printer:template:')).catch(() => null);
    const label = buildLabel(zpl, template);
    const id = Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
    const j = { id, ds: s.ds, key, slot, thing, zpl: label.zpl, at: Date.now(), selfContained: label.selfContained, templated: label.templated };
    const payload = JSON.stringify({ id, slot, zpl: label.zpl });
    if (Buffer.byteLength(payload) > cfg.maxPayload) { await R('rpush', key + ':dead', zpl); await trace(j, 'rejected', 'label too big for MQTT: ' + payload.length + ' bytes'); return; }
    try {
      await publishJob(thing, payload);
      inflight.set(id, j);
      log('sent', key, '->', thing, 'id', id, label.zpl.length + ' bytes', label.templated ? '(template prepended)' : '');
    } catch (e) {
      await R('lpush', key, zpl).catch(() => {});                 // never lose it: back to the head of the queue
      log('publish failed, job back on', key, e && e.message);
      backoffUntil = Date.now() + 5000;
    }
  }
  function publishJob(thing, payload) {
    const topic = `${thing}/direct`;
    if (!THING_RE.test(thing) || !/^TT2-[^/]+\/direct$/.test(topic)) return Promise.reject(new Error('refusing topic ' + topic));
    return mqtt.publish(topic, payload);
  }

  function loop() {
    if (stopped) return;
    const plan = feedPlan(cfg.datasets, [...stations.values()], aliveClaims, Date.now(), cfg.statusFreshMs);
    const c = plan.conflicts.join(' | ');
    if (c !== lastConflicts) { if (c) log('CONFLICT', c); lastConflicts = c; }
    const keys = [...plan.feed.keys()];
    if (!keys.length || !mqttUp || Date.now() < backoffUntil) return setTimeout(loop, 2000);
    block.blpop(...keys, cfg.blpopSec, (err, res) => {
      if (err) { log('blpop error, re-arming:', err.code || err.message); return setTimeout(loop, 1000); }
      if (!res) return setImmediate(loop);
      handleJob(res[0], res[1], plan.feed.get(res[0])).catch(e => log('job error', e.message)).then(() => setImmediate(loop));
    });
  }

  return {
    async start() {
      await refreshDevices(); await refreshAlive();
      timers.push(setInterval(() => refreshDevices().catch(e => log('devices', e.message)), cfg.devicesEveryMs));
      timers.push(setInterval(() => refreshAlive().catch(e => log('alive', e.message)), cfg.aliveEveryMs));
      timers.push(setInterval(() => sweep().catch(e => log('sweep', e.message)), 60000));
      loop();
    },
    stop() { stopped = true; timers.forEach(clearInterval); },
    setMqttUp(v) { mqttUp = v; },
    _state: () => ({ stations, inflight, aliveClaims }),
    _refreshAlive: refreshAlive,
    _refreshDevices: refreshDevices,
  };
}

// ------------------------------------------------------------------ real dependencies (Monkey)
function openSqlite(file) {
  try { const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(file, { readOnly: true }); return { all: (q) => db.prepare(q).all(), close: () => db.close() }; }
  catch (e) { /* node < 22.5: fall back to Reggi's better-sqlite3 */ }
  const Database = require('D:/cot/node_modules/better-sqlite3');
  const db = new Database(file, { readonly: true, fileMustExist: true });
  return { all: (q) => db.prepare(q).all(), close: () => db.close() };
}
function listDevicesFromDb(ds) {
  const file = path.join(CFG.datasetsDir, ds, 'devices.db');
  if (!fs.existsSync(file)) return [];             // no company link yet = no stations
  const db = openSqlite(file);
  try {
    return db.all(`SELECT device_id, thing_name FROM device WHERE kind = 'TRUETAG2' AND status = 'active' AND thing_name IS NOT NULL`)
      .map(r => ({ deviceId: r.device_id, thing: String(r.thing_name) }));
  } finally { db.close(); }
}
function frogPassword() {
  if (process.env.TT2BRIDGE_FROG_PASSWORD) return process.env.TT2BRIDGE_FROG_PASSWORD;
  const f = path.join(CFG.certDir, 'frog.txt');
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim();
  console.error('tt2bridge: no Frog password (env TT2BRIDGE_FROG_PASSWORD or ' + f + ')'); process.exit(125);
}
async function connectMqtt(onMessage) {
  const { mqtt, iot } = require('aws-iot-device-sdk-v2');
  const b = iot.AwsIotMqttConnectionConfigBuilder.new_mtls_builder_from_path(path.join(CFG.certDir, 'cert.pem'), path.join(CFG.certDir, 'key.pem'));
  b.with_certificate_authority_from_path(undefined, path.join(CFG.certDir, 'ca.pem'));
  b.with_clean_session(false); b.with_client_id(CFG.clientId); b.with_endpoint(CFG.endpoint);
  const conn = new mqtt.MqttClient().new_connection(b.build());
  await conn.connect();
  log('MQTT connected as', CFG.clientId);
  const decode = p => { try { return JSON.parse(Buffer.from(p).toString('utf8')); } catch (e) { return null; } };
  return {
    conn,
    publish: (topic, payload) => conn.publish(topic, payload, mqtt.QoS.AtLeastOnce),
    subscribe: (topic, fn) => conn.subscribe(topic, mqtt.QoS.AtLeastOnce, (t, p) => { try { fn(decode(p)); } catch (e) { log('handler', t, e.message); } })
      .catch(e => log('subscribe failed', topic, e && e.message)),
    unsubscribe: (topic) => conn.unsubscribe(topic).catch(() => {}),
  };
}

async function main() {
  const redis = require('redis');
  const pw = frogPassword();
  const mk = () => { const c = redis.createClient({ host: CFG.frogHost, port: CFG.frogPort, password: pw }); c.on('error', e => log('Frog error:', e && e.code)); return c; };
  const cmd = mk(), block = mk();
  const mq = await connectMqtt();
  const bridge = createBridge({ cmd, block, mqtt: mq, listDevices: listDevicesFromDb });
  mq.conn.on('interrupt', e => { log('MQTT interrupted', e && e.toString()); bridge.setMqttUp(false); });
  mq.conn.on('resume', () => { log('MQTT resumed'); bridge.setMqttUp(true); });
  mq.conn.on('disconnect', () => { log('MQTT disconnected, exiting (the tab loop restarts me)'); process.exit(123); });
  let sqlite = 'node:sqlite'; try { require('node:sqlite'); } catch (e) { sqlite = fs.existsSync('D:/cot/node_modules/better-sqlite3') ? 'D:/cot better-sqlite3' : 'NONE (devices.db unreadable: no station will be fed)'; }
  log('node', process.version, '| sqlite', sqlite, '| datasets', CFG.datasets.join(','), '| devices from', CFG.datasetsDir);
  await bridge.start();
}

if (require.main === module) main().catch(e => { console.error('tt2bridge failed to start:', e); process.exit(1); });
module.exports = { feedPlan, buildLabel, createBridge, CFG };

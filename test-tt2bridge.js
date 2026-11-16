// test-tt2bridge.js — tt2bridge against REAL Frog (throwaway keys tt2bridgetest:*) with a FAKE MQTT.
// Run on georg: TT2BRIDGE_FROG_PASSWORD=... node test-tt2bridge.js   (redis 2.8.0 is loaded from Monkey's mqttbb)
// Author: taghkanic gen-19 2026-11-16
'use strict';
const path = require('path');
const redisPath = process.env.REDIS_MODULE || '//15.30.60.40/monkeyd/mqttbb/node_modules/redis';
const redis = require(redisPath);
const { feedPlan, buildLabel, createBridge } = require('./tt2bridge.js');

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const DS = 'tt2bridgetest', T1 = 'TT2-tt2bridgetest-dev1', T2 = 'TT2-tt2bridgetest-dev2', K1 = DS + ':printer:1';

// ---- pure logic
const now = Date.now();
const st = (thing, slots, extra = {}) => Object.assign({ ds: DS, thing, connected: true, statusAt: now, status: { type: 'status', state: 'ready', slots } }, extra);
let p = feedPlan([DS], [st(T1, { 1: { state: 'ready' } })], {}, now, 90000);
ok(p.feed.get(K1) === T1 && p.feed.size === 1, 'plan: ready station + ready slot 1 -> feed slot 1');
ok(feedPlan([DS], [st(T1, { 1: { state: 'ready' } }, { statusAt: now - 91000 })], {}, now, 90000).feed.size === 0, 'plan: status older than 90 s -> no feed');
ok(feedPlan([DS], [st(T1, { 1: { state: 'down' } })], {}, now, 90000).feed.size === 0, 'plan: slot down -> no feed');
ok(feedPlan([DS], [st(T1, { 1: { state: 'ready' } }, { connected: false })], {}, now, 90000).feed.size === 0, 'plan: disconnected -> no feed');
p = feedPlan([DS], [st(T1, { 1: { state: 'ready' } }), st(T2, { 1: { state: 'ready' }, 2: { state: 'ready' } })], {}, now, 90000);
ok(!p.feed.has(K1) && p.feed.get(DS + ':printer:2') === T2 && p.conflicts.length === 1, 'plan: two stations on slot 1 -> neither, conflict; slot 2 still fed');
ok(feedPlan([DS], [st(T1, { 1: { state: 'ready' } })], { [DS]: 'ALL' }, now, 90000).feed.size === 0, 'plan: Frog-reading TrueTag2 alive (slots unknown) -> stay off');
ok(feedPlan([DS], [st(T1, { 1: { state: 'ready' }, 2: { state: 'ready' } })], { [DS]: new Set(['1']) }, now, 90000).feed.size === 1, 'plan: alive TrueTag2 on slot 1 only -> feed slot 2 only');
ok(buildLabel('^XA^DFR:X^FS^XZ^XA^XFR:X^XZ', 'TPL').zpl === '^XA^DFR:X^FS^XZ^XA^XFR:X^XZ', 'label: self-contained job is never given a template');
ok(buildLabel('^XA^XFR:SAMPLE.GRF^FN1^FDx^FS^XZ', '^XA^DFR:SAMPLE.GRF^FS^XZ').zpl.startsWith('^XA^DFR:SAMPLE.GRF'), 'label: data-only job gets the slot template prepended');

// ---- integration: real Frog, fake MQTT
const pw = process.env.TT2BRIDGE_FROG_PASSWORD;
if (!pw) { console.log('set TT2BRIDGE_FROG_PASSWORD for the Frog part'); process.exit(fails ? 1 : 0); }
const mk = () => redis.createClient({ host: '54.173.177.227', port: 7721, password: pw });
const cmd = mk(), block = mk(), t = mk();
const R = (fn, ...a) => new Promise((res, rej) => t[fn](...a, (e, v) => e ? rej(e) : res(v)));
const subs = new Map(), published = []; let failPublish = false;
const fakeMqtt = {
  publish: (topic, payload) => failPublish ? Promise.reject(new Error('fake broker down')) : (published.push({ topic, payload: JSON.parse(payload) }), Promise.resolve()),
  subscribe: (topic, fn) => subs.set(topic, fn),
  unsubscribe: (topic) => subs.delete(topic),
};
let devices = [{ deviceId: 'dev1', thing: T1 }, { deviceId: 'zt', thing: 'ZebraTail-5E_AB_C0' }];
const cfg = { datasets: [DS], statusFreshMs: 90000, devicesEveryMs: 3600e3, aliveEveryMs: 3600e3, resultWaitMs: 3600e3, blpopSec: 1, maxPayload: 120 * 1024 };

(async () => {
  const del = async () => { const ks = await R('keys', DS + ':*'); if (ks.length) await R('del', ...ks); };
  await del();
  const bridge = createBridge({ cmd, block, mqtt: fakeMqtt, listDevices: () => devices }, cfg);
  await bridge.start();
  ok(subs.has(T1 + '/status') && subs.has(T1 + '/result') && subs.has('$aws/events/presence/connected/' + T1) && subs.has('$aws/events/presence/disconnected/' + T1), 'subscribes status, result and both presence topics for the linked station');
  ok(![...subs.keys()].some(k => k.includes('ZebraTail')), 'a non-TT2 thing in devices.db is ignored');

  await R('rpush', K1, '^XA^DFR:PALLET.GRF^FS^XZ^XA^XFR:PALLET.GRF^FN1^FDA^FS^XZ');
  await wait(2500);
  ok(published.length === 0 && await R('llen', K1) === 1, 'no status yet -> job WAITS in Frog, nothing published');

  subs.get(T1 + '/status')({ type: 'status', state: 'ready', slots: { 1: { state: 'ready', printer: 'ZT421' } }, version: 'test' });
  await wait(3000);
  const p1 = published[0];
  ok(p1 && p1.topic === T1 + '/direct' && p1.payload.slot === '1' && p1.payload.zpl.includes('^FDA^FS') && p1.payload.id, 'station ready -> job published to <thing>/direct as {id, slot, zpl}');
  ok(await R('llen', K1) === 0, 'Frog queue drained');

  await R('set', DS + ':printer:template:1', '^XA^DFR:SAMPLE.GRF^FO1,1^FN1^FS^XZ');
  await R('rpush', K1, '^XA^XFR:SAMPLE.GRF^FN1^FDB^FS^XZ');
  await wait(2500);
  const p2 = published[1];
  ok(p2 && p2.payload.zpl.startsWith('^XA^DFR:SAMPLE.GRF') && p2.payload.zpl.includes('^FDB^FS'), 'data-only job -> template prepended before publishing');

  subs.get(T1 + '/result')({ id: p1.payload.id, slot: '1', result: 'printed' });
  subs.get(T1 + '/result')({ id: p2.payload.id, slot: '1', result: 'failed', error: 'printer offline' });
  await wait(800);
  const tr = (await R('lrange', K1 + ':trace', 0, 5)).map(x => JSON.parse(x));
  ok(tr.some(r => r.id === p1.payload.id && r.result === 'printed' && r.delivery.label === 'mqtt:' + T1 && r.via === 'tt2bridge'), 'result printed -> trace row in TrueTag2 shape');
  ok(tr.some(r => r.id === p2.payload.id && r.result === 'failed' && r.error === 'printer offline'), 'result failed -> trace row with the error');
  ok((await R('lrange', K1 + ':dead', 0, -1)).some(x => x.includes('^FDB^FS')), 'failed label -> dead list');
  subs.get(T1 + '/result')({ id: p1.payload.id, slot: '1', result: 'printed' });
  ok((await R('llen', K1 + ':trace')) === tr.length, 'a repeated result for the same id is ignored');

  failPublish = true;
  await R('rpush', K1, '^XA^DFX^FS^XZ^XA^XFR:X^FDC^FS^XZ');
  await wait(2500);
  ok((await R('lrange', K1, 0, -1)).some(x => x.includes('^FDC^FS')), 'publish fails -> job put BACK on the Frog queue, not lost');
  failPublish = false;
  await wait(8000);
  ok(published.some(x => x.payload.zpl.includes('^FDC^FS')) && await R('llen', K1) === 0, 'after the backoff the job is published');

  await R('set', DS + ':tt2:alive:SITEPC', JSON.stringify({ slots: { 1: { state: 'ready' } } }), 'EX', 60);
  await bridge._refreshAlive();
  const before = published.length;
  await R('rpush', K1, '^XA^DFX^FS^XZ^XA^XFR:X^FDD^FS^XZ');
  await wait(2500);
  ok(published.length === before && await R('llen', K1) === 1, 'Frog-reading TrueTag2 alive on slot 1 -> bridge leaves the slot alone');
  const alive = JSON.parse(await R('get', DS + ':tt2bridge:alive'));
  ok(alive && alive.conflicts.length === 1, 'the bridge publishes its own alive key with the conflict');
  await R('del', DS + ':tt2:alive:SITEPC'); await bridge._refreshAlive();
  await wait(2500);
  ok(await R('llen', K1) === 0, 'alive key gone -> slot fed again');

  subs.get('$aws/events/presence/disconnected/' + T1)({});
  await R('rpush', K1, '^XA^DFX^FS^XZ^XA^XFR:X^FDE^FS^XZ');
  await wait(2500);
  ok(await R('llen', K1) === 1, 'station disconnected -> job waits');
  subs.get('$aws/events/presence/connected/' + T1)({});
  subs.get(T1 + '/status')({ type: 'status', state: 'ready', slots: { 1: { state: 'ready' } } });
  await wait(2500);
  ok(await R('llen', K1) === 0, 'reconnected + status -> fed');

  devices = [];
  await bridge._refreshDevices();
  ok(!subs.has(T1 + '/status'), 'station removed in devices.db -> unsubscribed');
  await R('rpush', K1, '^XA^DFX^FS^XZ^XA^XFR:X^FDF^FS^XZ');
  await wait(2500);
  ok(await R('llen', K1) === 1, 'removed station is never fed');

  bridge.stop(); await del();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  setTimeout(() => process.exit(fails ? 1 : 0), 1500);
})().catch(e => { console.error(e); process.exit(1); });

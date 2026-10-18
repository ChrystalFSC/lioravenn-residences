// Run: node --test tests/motion-preferences.test.cjs
// Exercise the real preference API before DOMContentLoaded; UI layout is browser QA.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const file = path.resolve(__dirname, '../js/motion-preferences.js');
const source = fs.readFileSync(file, 'utf8');
const { normalizeMode, motionEnabled } = require(file);
const KEY = 'lioravenn-motion-preference';
const CHANGE = 'lioravenn:motion-change';

class Target {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  dispatchEvent(event) {
    for (const listener of [...(this.listeners.get(event.type) || [])]) listener(event);
    return true;
  }
  emit(type, values = {}) { this.dispatchEvent({ type, ...values }); }
}

function fixture({ saved = null, reduced = false, saveData = false, readBlocked = false,
                   writeBlocked = false, storageUnavailable = false, legacy = false,
                   query = '', hash = '' } = {}) {
  const window = new Target();
  const document = new Target();
  const mql = new Target();
  mql.matches = reduced;
  mql.media = '(prefers-reduced-motion: reduce)';
  if (legacy) {
    mql.addListener = listener => Target.prototype.addEventListener.call(mql, 'change', listener);
    mql.removeListener = listener => Target.prototype.removeEventListener.call(mql, 'change', listener);
    mql.addEventListener = undefined;
  }
  const values = new Map(saved === null ? [] : [[KEY, saved]]);
  const writes = [];
  const storage = {
    getItem(key) { if (readBlocked) throw new Error('Storage access denied'); return values.get(key) ?? null; },
    setItem(key, value) {
      if (writeBlocked) throw new Error('Storage quota unavailable');
      writes.push([key, String(value)]); values.set(key, String(value));
    },
    removeItem(key) { values.delete(key); }
  };
  const attrs = new Map();
  document.readyState = 'loading';
  document.documentElement = {
    dataset: {},
    setAttribute(name, value) {
      attrs.set(name, String(value));
      if (name === 'data-motion-preference') this.dataset.motionPreference = String(value);
    },
    getAttribute(name) {
      return name === 'data-motion-preference' ? this.dataset.motionPreference ?? null : attrs.get(name) ?? null;
    }
  };
  const connection = new Target();
  connection.saveData = saveData;
  const historyCalls = [];
  const location = { pathname: '/lioravenn-residences/index.html', search: query, hash };
  const history = {
    state: { chapter: 'welcome' },
    replaceState(state, title, target) {
      historyCalls.push([state, title, target]);
      this.state = state;
      const next = new URL(target, 'https://example.test');
      Object.assign(location, { pathname: next.pathname, search: next.search, hash: next.hash });
    }
  };
  class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } }
  Object.assign(window, {
    document, navigator: { connection }, matchMedia: () => mql,
    CustomEvent, Event: CustomEvent, location, history
  });
  Object.defineProperty(window, 'localStorage', {
    get() { if (storageUnavailable) throw new Error('Storage disabled'); return storage; }
  });
  const context = vm.createContext({ window, document, navigator: window.navigator,
    CustomEvent, Event: CustomEvent, URLSearchParams, console });
  Object.defineProperty(context, 'localStorage', { get: () => window.localStorage });
  vm.runInContext(source, context, { filename: file });
  const api = window.LioravennMotion;
  return {
    window, document, api, storage, writes, historyCalls,
    state: () => [api.getMode(), api.isEnabled(), document.documentElement.getAttribute('data-motion-preference')],
    motion(value) { mql.matches = value; mql.emit('change', { matches: value, media: mql.media }); },
    saved(value, key = KEY) { window.emit('storage', { key, newValue: value, storageArea: storage }); }
  };
}

test('pure normalization rejects unsupported and malformed persisted values', () => {
  const inputs = ['auto', 'on', 'off', '', 'ON', null, undefined, {}, true];
  assert.deepEqual(inputs.map(normalizeMode), ['auto', 'on', 'off', 'on', 'on', 'on', 'on', 'on', 'on']);
});

test('explicit motion overrides OS reduction while Save-Data remains authoritative', () => {
  assert.deepEqual([
    motionEnabled('auto', false), motionEnabled('auto', true),
    motionEnabled('on', true), motionEnabled('off', false)
  ], [true, false, true, false]);
  assert.deepEqual(['auto', 'on', 'off'].map(mode => motionEnabled(mode, false, true)), [false, false, false]);
});

test('fresh visits default to On while valid saved Auto and Off remain authoritative', () => {
  assert.deepEqual([
    fixture().state(), fixture({ reduced: true }).state(), fixture({ saved: 'off' }).state(),
    fixture({ saved: 'on', reduced: true }).state(),
    fixture({ saved: 'auto', reduced: true }).state(), fixture({ saved: 'auto' }).state(),
    fixture({ saved: 'invalid', reduced: true }).state()
  ], [['on', true, 'on'], ['on', true, 'on'], ['off', false, 'off'], ['on', true, 'on'],
    ['auto', false, 'auto'], ['auto', true, 'auto'], ['on', true, 'on']]);
});

test('an explicit demo link overrides a saved preference while invalid queries do not', () => {
  const enabled = fixture({ saved: 'off', reduced: true, query: '?motion=on' });
  const automatic = fixture({ saved: 'on', reduced: true, query: '?motion=auto' });
  const invalid = fixture({ saved: 'off', query: '?motion=unexpected' });
  assert.deepEqual([enabled.state(), automatic.state(), invalid.state()],
    [['on', true, 'on'], ['auto', false, 'auto'], ['off', false, 'off']]);
  assert.deepEqual([enabled.writes, automatic.writes, invalid.writes],
    [[[KEY, 'on']], [[KEY, 'auto']], []]);
});

test('setMode persists and publishes its updated state synchronously only on change', () => {
  const f = fixture({ saved: 'auto', reduced: true });
  const observed = [];
  f.window.addEventListener(CHANGE, () => observed.push(f.state()));
  assert.equal(f.api.setMode('on'), 'on');
  assert.deepEqual(observed, [['on', true, 'on']], 'Consumers must observe the new effective state during the event');
  assert.deepEqual(f.writes, [[KEY, 'on']]);
  f.api.setMode('on');
  assert.equal(observed.length, 1, 'Re-selecting a mode must not retrigger playback consumers');
  assert.equal(f.api.setMode('invalid'), 'on');
});

test('changing a demo-link mode removes only that override so refresh retains the saved choice', () => {
  const f = fixture({ query: '?motion=off&v=review', hash: '#lifestyle' });
  f.api.setMode('on');
  assert.deepEqual(f.historyCalls, [[{ chapter: 'welcome' }, '',
    '/lioravenn-residences/index.html?v=review#lifestyle']]);
  const refreshed = fixture({ saved: f.storage.getItem(KEY),
    query: f.window.location.search, hash: f.window.location.hash });
  assert.deepEqual(refreshed.state(), ['on', true, 'on']);
  const ordinary = fixture({ query: '?v=review', hash: '#lifestyle' });
  ordinary.api.setMode('off');
  assert.deepEqual(ordinary.historyCalls, [], 'Ordinary query strings must not trigger history changes');
});

test('automatic mode follows live OS changes and explicit on survives them', () => {
  const f = fixture({ saved: 'auto' });
  const observed = [];
  f.window.addEventListener(CHANGE, () => observed.push(f.api.isEnabled()));
  f.motion(true);
  f.motion(false);
  assert.deepEqual(observed, [false, true], 'OS changes must notify video and scroll consumers');
  f.api.setMode('on');
  f.motion(true);
  assert.deepEqual(f.state(), ['on', true, 'on']);
});

test('blocked storage does not prevent initialization or a session preference', () => {
  const denied = fixture({ saved: 'off', reduced: true, readBlocked: true, writeBlocked: true });
  assert.deepEqual(denied.state(), ['on', true, 'on']);
  denied.api.setMode('off');
  assert.deepEqual(denied.state(), ['off', false, 'off']);
  const unavailable = fixture({ reduced: true, storageUnavailable: true });
  assert.deepEqual(unavailable.state(), ['on', true, 'on']);
});

test('cross-tab changes normalize state without echoing another storage write', () => {
  const f = fixture();
  const observed = [];
  f.window.addEventListener(CHANGE, () => observed.push(f.state()));
  f.saved('off');
  f.saved('on', 'unrelated-preference');
  f.saved(null);
  assert.deepEqual(observed, [['off', false, 'off'], ['on', true, 'on']]);
  assert.deepEqual(f.writes, [], 'Storage notifications must not write back and loop across tabs');
});

test('legacy MediaQueryList listeners still update automatic motion', () => {
  const f = fixture({ saved: 'auto', legacy: true });
  f.motion(true);
  assert.deepEqual(f.state(), ['auto', false, 'auto']);
});

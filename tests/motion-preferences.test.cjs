// Run: node --test tests/motion-preferences.test.cjs
// Execute the real background API without a browser or any menu markup.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const file = path.resolve(__dirname, '../js/motion-preferences.js');
const source = fs.readFileSync(file, 'utf8');
const CHANGE = 'lioravenn:motion-change';

class Target {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  dispatchEvent(event) {
    for (const listener of [...(this.listeners.get(event.type) || [])]) listener(event);
    return true;
  }
  emit(type, values = {}) { this.dispatchEvent({ type, ...values }); }
}

function fixture({ saved = null, reduced = false, query = '', blockedStorage = false,
                   saveData = false, noConnection = false, readyState = 'loading' } = {}) {
  const window = new Target();
  const document = new Target();
  const connection = new Target();
  connection.saveData = saveData;
  const calls = { storage: 0, storageWrites: 0, media: 0, ui: 0, history: 0 };
  const attrs = new Map();
  document.readyState = readyState;
  document.documentElement = {
    setAttribute: (name, value) => attrs.set(name, String(value)),
    getAttribute: name => attrs.get(name) ?? null
  };
  document.createElement = () => { calls.ui++; throw new Error('The motion API must not create UI'); };
  document.body = { append: () => calls.ui++ };
  class Event { constructor(type) { this.type = type; } }
  Object.assign(window, {
    document, Event,
    navigator: noConnection ? {} : { connection },
    location: { search: query },
    history: { replaceState: () => calls.history++ },
    matchMedia: () => {
      calls.media++;
      return { matches: reduced, addEventListener() {}, addListener() {} };
    }
  });
  Object.defineProperty(window, 'localStorage', { get() {
    calls.storage++;
    if (blockedStorage) throw new Error('Storage disabled');
    return { getItem: () => saved, setItem: () => calls.storageWrites++ };
  } });
  const context = vm.createContext({ window, document, URLSearchParams, console });
  vm.runInContext(source, context, { filename: file });
  const api = window.LioravennMotion;
  return {
    window, document, connection, api, calls,
    state: () => [api.getMode(), api.isEnabled(),
      document.documentElement.getAttribute('data-motion-preference'),
      document.documentElement.getAttribute('data-motion-enabled')],
    saving(value) { connection.saveData = value; connection.emit('change'); }
  };
}

test('fresh visits always expose On, including an OS reduced-motion preference', () => {
  assert.deepEqual([fixture().state(), fixture({ reduced: true }).state()],
    [['on', true, 'on', 'true'], ['on', true, 'on', 'true']]);
  assert.deepEqual(Object.keys(fixture().api).sort(), ['getMode', 'isEnabled']);
});

test('old Off/Auto storage and motion query parameters cannot disable the site', () => {
  const fixtures = [
    fixture({ saved: 'off', reduced: true, query: '?motion=off' }),
    fixture({ saved: 'auto', reduced: true, query: '?motion=auto' })
  ];
  assert.deepEqual(fixtures.map(f => f.state()), [
    ['on', true, 'on', 'true'], ['on', true, 'on', 'true']
  ]);
  assert.deepEqual(fixtures.map(f => f.calls), [
    { storage: 0, storageWrites: 0, media: 0, ui: 0, history: 0 },
    { storage: 0, storageWrites: 0, media: 0, ui: 0, history: 0 }
  ]);
  fixtures[0].window.emit('storage', { key: 'lioravenn-motion-preference', newValue: 'off' });
  assert.deepEqual(fixtures[0].state(), ['on', true, 'on', 'true']);
});

test('denied storage and an unavailable Network Information API remain harmless', () => {
  assert.deepEqual([
    fixture({ blockedStorage: true, reduced: true }).state(),
    fixture({ noConnection: true }).state()
  ], [['on', true, 'on', 'true'], ['on', true, 'on', 'true']]);
});

test('neither initial execution nor DOM readiness mounts a visible motion control', () => {
  const loading = fixture();
  const complete = fixture({ readyState: 'complete' });
  loading.document.emit('DOMContentLoaded');
  assert.deepEqual([loading, complete].map(f => [f.calls.ui, f.document.listeners.size]), [[0, 0], [0, 0]]);
});

test('Save-Data pauses effects without changing the fixed On mode', () => {
  assert.deepEqual(fixture({ saveData: true }).state(), ['on', false, 'on', 'false']);
});

test('live Save-Data changes notify consumers synchronously after root attributes update', () => {
  const f = fixture();
  const observed = [];
  f.window.addEventListener(CHANGE, () => observed.push(f.state()));
  f.saving(true);
  assert.deepEqual(observed, [['on', false, 'on', 'false']]);
  f.saving(true);
  f.connection.effectiveType = '3g';
  f.connection.emit('change');
  assert.equal(observed.length, 1, 'Unchanged effective motion must not restart consumers');
  f.saving(false);
  assert.deepEqual(observed, [['on', false, 'on', 'false'], ['on', true, 'on', 'true']]);
});

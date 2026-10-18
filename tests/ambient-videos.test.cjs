// Run: node tests/ambient-videos.test.cjs
// Execute the real controller with deterministic media/observer/timer fixtures.
// Browser QA still covers native decoder performance and autoplay policy.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/ambient-videos.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const api = require(path.join(root, 'js/ambient-videos.js'));
let assertions = 0;
let cases = 0;
const failures = [];
function equal(actual, expected, message) { assert.deepEqual(actual, expected, message); assertions++; }
function ok(value, message) { assert.ok(value, message); assertions++; }
async function settle() { for (let i = 0; i < 10; i++) await Promise.resolve(); }
function mediaError(name) { return Object.assign(new Error(name), { name }); }

function attributes(text) {
  return Object.fromEntries([...text.matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1], match[2].replace(/&amp;/g, '&')]));
}
const markupVideos = [...html.matchAll(/<video\b([^>]*)>([\s\S]*?)<\/video>/g)]
  .filter(match => /\bdata-ambient-video\b/.test(match[1]))
  .map(match => ({ attrs: attributes(match[1]), sources: [...match[2].matchAll(/<source\b([^>]*)>/g)].map(item => attributes(item[1])) }));

class Target {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(callback);
  }
  emit(type, event = {}) {
    event.type = type;
    event.target ||= this;
    for (const callback of [...(this.listeners.get(type) || [])]) callback(event);
  }
}

class Clock {
  constructor() { this.now = 0; this.next = 1; this.jobs = new Map(); }
  set(callback, delay = 0) { const id = this.next++; this.jobs.set(id, { at: this.now + delay, callback }); return id; }
  clear(id) { this.jobs.delete(id); }
  async tick(milliseconds) {
    const end = this.now + milliseconds;
    let iterations = 0;
    while (true) {
      const next = [...this.jobs].filter(([, job]) => job.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      if (++iterations > 1000) throw new Error('Timer loop did not settle');
      this.now = next[1].at;
      this.jobs.delete(next[0]);
      next[1].callback();
      await settle();
    }
    this.now = end;
    await settle();
  }
}

function fixture(options = {}) {
  const clock = new Clock();
  const document = new Target();
  const window = new Target();
  const observers = [];
  let inGesture = false;
  const connection = new Target();
  Object.assign(connection, { saveData: false, effectiveType: '4g', downlink: 10 }, options.connection);
  const reduced = new Target();
  reduced.matches = !!options.reduced;
  if (options.oldMql) {
    reduced.addEventListener = undefined;
    reduced.addListener = callback => Target.prototype.addEventListener.call(reduced, 'change', callback);
  }
  const coarse = { matches: !!options.coarse };
  document.hidden = !!options.hidden;
  document.documentElement = { clientHeight: options.height || 800 };
  Object.assign(window, {
    innerWidth: options.width || 1440,
    innerHeight: options.height || 800,
    navigator: { connection, deviceMemory: options.memory ?? 8, hardwareConcurrency: options.cores ?? 8 },
    setTimeout: (callback, delay) => clock.set(callback, delay),
    clearTimeout: id => clock.clear(id),
    requestAnimationFrame: callback => clock.set(callback, 16),
    matchMedia: query => query.includes('prefers-reduced-motion') ? reduced : coarse
  });
  if (options.noMatchMedia) delete window.matchMedia;
  if (options.noRaf) delete window.requestAnimationFrame;
  let motionMode = options.motionMode;
  const installMotionApi = () => {
    window.LioravennMotion = {
      isEnabled: () => motionMode === 'on' || (motionMode !== 'off' && !reduced.matches)
    };
  };
  if (motionMode !== undefined) installMotionApi();
  if (!options.noObserver) {
    window.IntersectionObserver = class {
      constructor(callback, observerOptions) { this.callback = callback; this.options = observerOptions; this.targets = []; observers.push(this); }
      observe(video) { this.targets.push(video); }
      fire(video, isIntersecting) { this.callback([{ target: video, isIntersecting }]); }
    };
  }

  const videos = markupVideos.map((markup, index) => {
    const video = new Target();
    const classes = new Set();
    video.surface = { classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) } };
    video.attrs = { ...markup.attrs };
    video.sources = (options.sources || markup.sources).map(attrs => ({
      dataset: { src: attrs['data-src'], srcMobile: attrs['data-src-mobile'] }, type: attrs.type
    }));
    video.bounds = { top: (options.positions || [100, 2000])[index] ?? 2000, height: 400, width: 1000 };
    video.paused = true;
    video.readyState = 0;
    let mediaTime = 0;
    let playingSince = null;
    let clockFrozen = false;
    Object.defineProperty(video, 'currentTime', {
      get: () => mediaTime + (playingSince === null || clockFrozen ? 0 : (clock.now - playingSince) / 1000),
      set: value => { mediaTime = Number(value); if (playingSince !== null) playingSince = clock.now; }
    });
    video.freezePlaybackClock = () => { mediaTime = video.currentTime; playingSince = clock.now; clockFrozen = true; };
    video.resumePlaybackClock = () => { clockFrozen = false; playingSince = video.paused ? null : clock.now; };
    video.autoplay = true;
    video.loads = [];
    video.attempts = [];
    video.playPlan = [...(options.plans?.[index] || [])];
    video.defaultPlay = options.defaultPlay || 'resolve';
    video.pauseCalls = 0;
    video.removedAttributes = [];
    Object.defineProperty(video, 'src', {
      get: () => video.attrs.src || '',
      set: value => { video.attrs.src = String(value); }
    });
    Object.defineProperty(video, 'requestedSources', { get: () => video.loads.filter(Boolean) });
    video.querySelectorAll = () => video.sources;
    video.closest = () => video.surface;
    video.setAttribute = (name, value) => { video.attrs[name] = value; };
    video.removeAttribute = name => { video.removedAttributes.push(name); delete video.attrs[name]; };
    video.canPlayType = type => (options.unsupported || []).includes(type) ? '' : 'probably';
    video.getBoundingClientRect = () => ({ ...video.bounds, bottom: video.bounds.top + video.bounds.height });
    video.load = () => {
      video.loads.push(video.src); video.currentSrc = video.src;
      playingSince = null; mediaTime = 0; video.readyState = 0; video.paused = true;
    };
    video.pause = () => {
      video.pauseCalls++; mediaTime = video.currentTime; playingSince = null; video.paused = true;
    };
    video.play = () => {
      const plan = video.playPlan.shift() || video.defaultPlay;
      const attempt = { gesture: inGesture, settled: false, src: video.src };
      video.attempts.push(attempt);
      video.paused = false; // Native play() clears paused before its promise settles.
      if (plan === 'throw-not-allowed') { video.paused = true; throw mediaError('NotAllowedError'); }
      let resolve, reject;
      const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
      attempt.resolve = () => {
        if (attempt.settled) return;
        attempt.settled = true;
        video.paused = false;
        video.readyState = 4;
        if (playingSince === null) playingSince = clock.now;
        video.emit('playing');
        resolve();
      };
      attempt.reject = name => {
        if (attempt.settled) return;
        attempt.settled = true;
        // An old source's rejected promise cannot pause a newer playback.
        if (video.attempts.at(-1) === attempt && attempt.src === video.src) {
          mediaTime = video.currentTime; playingSince = null; video.paused = true;
        }
        reject(mediaError(name));
      };
      if (plan === 'resolve') Promise.resolve().then(attempt.resolve);
      else if (plan === 'not-allowed') Promise.resolve().then(() => attempt.reject('NotAllowedError'));
      else if (plan === 'abort') Promise.resolve().then(() => attempt.reject('AbortError'));
      else if (plan === 'decode-error') Promise.resolve().then(() => attempt.reject('NotSupportedError'));
      return promise;
    };
    return video;
  });
  document.querySelectorAll = selector => selector === '[data-ambient-video]' ? videos : [];
  const context = vm.createContext({ window, document, console });
  vm.runInContext(source, context, { filename: 'js/ambient-videos.js' });
  return {
    window, document, connection, reduced, videos, clock, observers,
    visible(index, value) {
      const video = videos[index];
      video.bounds.top = value ? 100 : window.innerHeight + 500;
      const observer = observers.find(item => !item.options.rootMargin);
      if (observer) observer.fire(video, value);
      else window.emit('scroll');
    },
    near(index, value) {
      const video = videos[index];
      video.bounds.top = value ? window.innerHeight + 100 : window.innerHeight + 500;
      const observer = observers.find(item => item.options.rootMargin);
      if (observer) observer.fire(video, value);
      else window.emit('scroll');
    },
    hidden(value) { document.hidden = value; document.emit('visibilitychange'); },
    preferences(values) { Object.assign(connection, values); connection.emit('change'); },
    motion(value) { reduced.matches = value; reduced.emit('change'); },
    setMotionMode(mode) {
      if (!['auto', 'on', 'off'].includes(mode)) throw new Error(`Invalid motion fixture mode: ${mode}`);
      motionMode = mode;
      if (!window.LioravennMotion) installMotionApi();
      // The site's explicit preference button emits synchronously from a click.
      inGesture = true;
      try { window.emit('lioravenn:motion-change', { detail: { mode, enabled: window.LioravennMotion.isEnabled() } }); }
      finally { inGesture = false; }
    },
    gesture(type = 'click') { inGesture = true; try { document.emit(type); } finally { inGesture = false; } },
    playing(index = 0) { return videos[index].surface.classList.contains('is-playing'); }
  };
}

async function test(name, work) {
  cases++;
  try {
    await work();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

(async () => {
  await test('desktop/mobile and weak-network quality choices', async () => {
    equal(api.selectVideoQuality({ width: 1440, memory: 8, cores: 8, downlink: 10 }), 'balanced');
    for (const environment of [{ width: 390 }, { coarse: true }, { memory: 4 }, { cores: 4 }, { effectiveType: '3g' }, { downlink: 1.5 }]) equal(api.selectVideoQuality(environment), 'mobile');
    equal(api.selectVideoQuality(), 'balanced', 'Missing device hints must not punish a normal desktop');
    for (const options of [{ width: 390 }, { connection: { downlink: 1.5 } }, { cores: 4 }]) {
      const f = fixture(options); await settle();
      ok(f.videos[0].loads[0].includes('-mobile.mp4'), 'Restricted devices should request the smaller MP4 first');
    }
    const desktop = fixture(); await settle();
    ok(desktop.videos[0].loads[0].includes('-balanced.mp4'));
    desktop.window.innerWidth = 390; desktop.window.emit('resize'); await settle();
    equal(desktop.videos[0].loads.length, 1, 'A resize must not restart a healthy desktop video');
  });

  await test('source deduplication and codec fallback', async () => {
    const sources = [{ src: 'same.mp4', mobile: 'same.mp4', type: 'video/mp4' }, { src: 'same.mp4', type: 'video/mp4' }, { src: 'other.webm', type: 'video/webm' }];
    equal(api.sourceChoices(sources, 'balanced', () => true).map(item => item.url), ['same.mp4', 'other.webm']);
    equal(api.sourceChoices(sources, 'mobile', type => type === 'video/webm').map(item => item.url), ['other.webm']);
    const webm = fixture({ unsupported: ['video/mp4'] }); await settle();
    ok(webm.videos[0].loads[0].includes('.webm'));
    equal(webm.videos[0].loads.length, 1);
    const unsupported = fixture({ unsupported: ['video/mp4', 'video/webm'] }); await settle();
    equal(unsupported.videos[0].loads.length, 0);
    equal(unsupported.videos[0].attempts.length, 0);
    equal(unsupported.playing(), false);
  });

  await test('offscreen prewarm loads without playback', async () => {
    const f = fixture({ positions: [1000, 2400] }); await settle();
    equal(f.videos[0].loads.length, 1, 'A video inside the warm margin should prepare its source');
    equal(f.videos[0].attempts.length, 0, 'Prewarming must not start offscreen playback');
    equal(f.videos[1].loads.length, 0);
    f.near(1, true); await settle();
    equal(f.videos[1].loads.length, 1);
    equal(f.videos[1].attempts.length, 0);
    f.visible(0, true); await settle();
    equal(f.videos[0].attempts.length, 1);
    equal(f.videos[0].loads.length, 1, 'Entering view should reuse the prepared source');
  });

  await test('prewarm source failures advance without starting an offscreen video', async () => {
    const f = fixture({ positions: [1000, 2400] }); await settle();
    f.videos[0].emit('error'); await settle();
    equal(f.videos[0].loads.length, 2);
    ok(f.videos[0].loads[1].includes('-mobile.mp4'));
    equal(f.videos[0].attempts.length, 0);
    f.visible(0, true); await settle();
    equal(f.videos[0].paused, false); equal(f.playing(), true);
    equal(f.videos[0].loads.length, 2);
  });

  await test('only visible videos play and hidden documents pause', async () => {
    const f = fixture(); await settle();
    equal(f.videos[0].paused, false); equal(f.videos[1].attempts.length, 0);
    f.visible(0, false); f.visible(1, true); await settle();
    equal(f.videos[0].paused, true); equal(f.videos[1].paused, false);
    f.hidden(true); await settle(); equal(f.videos[1].paused, true);
    f.hidden(false); await settle();
    equal(f.videos[1].paused, false); equal(f.videos[0].paused, true);
    equal(f.videos[0].muted, true); equal(f.videos[0].defaultMuted, true);
    equal(f.videos[0].playsInline, true); equal(f.videos[0].loop, true);
  });

  await test('pending play is deduplicated and healthy playback is not restarted', async () => {
    const f = fixture({ plans: [['pending']] });
    f.visible(0, true); f.videos[0].emit('canplay'); f.document.emit('visibilitychange');
    equal(f.videos[0].attempts.length, 1);
    f.videos[0].attempts[0].resolve(); await settle();
    equal(f.videos[0].attempts.length, 1);
    equal(f.playing(), true);
    f.videos[0].emit('canplay'); await settle(); equal(f.videos[0].attempts.length, 1);
  });

  await test('pause and reenter recover after the previous play aborts', async () => {
    const f = fixture({ plans: [['pending']] });
    f.visible(0, false); f.visible(0, true);
    equal(f.videos[0].attempts.length, 1, 'Reentry should wait for the pending native attempt');
    f.videos[0].attempts[0].reject('AbortError'); await settle();
    equal(f.videos[0].attempts.length, 2);
    equal(f.videos[0].paused, false); equal(f.playing(), true);
    equal(f.videos[0].loads.length, 1, 'An expected abort must not cascade through source downloads');
  });

  await test('an obsolete play rejection cannot damage a working fallback', async () => {
    const f = fixture({ plans: [['pending']] });
    const previous = f.videos[0].attempts[0];
    f.videos[0].emit('error'); await settle();
    equal(f.videos[0].loads.length, 2); equal(f.playing(), true);
    previous.reject('NotSupportedError'); await settle();
    equal(f.videos[0].loads.length, 2, 'A stale rejection must not skip the healthy replacement source');
    equal(f.videos[0].paused, false, 'A stale rejected promise must leave the replacement playing');
    f.videos[0].emit('canplay'); await settle();
    equal(f.videos[0].paused, false); equal(f.videos[0].loads.length, 2);
  });

  await test('autoplay denial retries synchronously on a gesture without a download cascade', async () => {
    const f = fixture({ plans: [['not-allowed']] }); await settle();
    equal(f.videos[0].paused, true); equal(f.playing(), false);
    await f.clock.tick(60000);
    equal(f.videos[0].loads.length, 1); equal(f.videos[0].attempts.length, 1);
    f.gesture('pointerup');
    equal(f.videos[0].attempts.length, 2, 'Retry play() must run inside the gesture handler');
    equal(f.videos[0].attempts[1].gesture, true);
    await settle(); equal(f.playing(), true);
    ok(!/<video\b[^>]*\bcontrols\b/i.test(html), 'Ambient markup must not introduce player controls');
  });

  await test('synchronous autoplay denial and persistent low-power rejection stay bounded', async () => {
    const f = fixture({ plans: [['throw-not-allowed', 'not-allowed', 'not-allowed']] }); await settle();
    f.gesture('touchend'); await settle(); f.gesture('click'); await settle();
    await f.clock.tick(60000);
    equal(f.videos[0].loads.length, 1);
    equal(f.videos[0].attempts.length, 3);
    equal(f.playing(), false);
  });

  await test('buffer stalls fall through bounded source choices then retain the poster', async () => {
    const f = fixture({ defaultPlay: 'pending' });
    equal(f.videos[0].loads.length, 1);
    f.videos[0].surface.classList.add('is-playing');
    f.videos[0].emit('waiting'); f.videos[0].emit('stalled');
    await f.clock.tick(1200); equal(f.playing(), false);
    await f.clock.tick(6799); equal(f.videos[0].loads.length, 1);
    await f.clock.tick(1); equal(f.videos[0].loads.length, 2);
    ok(f.videos[0].loads[1].includes('-mobile.mp4'));
    await f.clock.tick(8000); equal(f.videos[0].loads.length, 3);
    ok(f.videos[0].loads[2].includes('.webm'));
    await f.clock.tick(8000); equal(f.videos[0].paused, true); equal(f.playing(), false);
    await f.clock.tick(60000); equal(f.videos[0].loads.length, 3, 'Exhaustion must not retry forever');
  });

  await test('healthy readiness and cancelled playback do not spuriously downgrade', async () => {
    const f = fixture(); await settle();
    f.videos[0].emit('stalled'); await f.clock.tick(20000);
    equal(f.videos[0].loads.length, 1); equal(f.playing(), true);
    const pending = fixture({ defaultPlay: 'pending' });
    pending.visible(0, false); await pending.clock.tick(20000);
    equal(pending.videos[0].loads.length, 1, 'Leaving view cancels recovery timers');
  });

  await test('old media-query APIs and no-observer geometry fallback work', async () => {
    const f = fixture({ noObserver: true, oldMql: true, positions: [2000, 2400] }); await settle();
    equal(f.videos[0].loads.length, 0);
    f.visible(0, true); f.window.emit('scroll'); f.window.emit('resize');
    await f.clock.tick(16); equal(f.videos[0].attempts.length, 1);
    f.motion(true); await settle(); equal(f.videos[0].paused, true);
    f.motion(false); await settle(); equal(f.videos[0].paused, false);
    const missingMql = fixture({ noMatchMedia: true }); await settle(); equal(missingMql.videos[0].paused, false);
    const oldQueue = fixture({ noObserver: true, noRaf: true, positions: [2000, 2400] });
    oldQueue.visible(0, true); oldQueue.window.emit('resize');
    await oldQueue.clock.tick(99); equal(oldQueue.videos[0].attempts.length, 0);
    await oldQueue.clock.tick(1); equal(oldQueue.videos[0].attempts.length, 1, 'Old browsers use the coalesced timer fallback');
  });

  await test('live motion, save-data and slow-connection preferences gate all playback', async () => {
    for (const options of [{ reduced: true }, { connection: { saveData: true } }, { connection: { effectiveType: '2g' } }, { connection: { effectiveType: 'slow-2g' } }]) {
      const f = fixture(options); await settle();
      equal(f.videos[0].loads.length, 0); equal(f.videos[0].attempts.length, 0);
    }
    const f = fixture(); await settle();
    f.preferences({ saveData: true }); await settle(); equal(f.videos[0].paused, true); equal(f.playing(), false);
    f.preferences({ saveData: false }); await settle(); equal(f.videos[0].paused, false);
    f.motion(true); await settle(); equal(f.videos[0].paused, true); equal(f.playing(), false);
    f.motion(false); await settle(); equal(f.videos[0].paused, false);
    equal(f.videos[0].requestedSources.length, 2, 'Leaving data-saving mode reloads once; motion changes reuse that ready clip');
  });

  await test('restrictive network preferences release visible and prewarmed resources, then resume cleanly', async () => {
    for (const restriction of [{ saveData: true }, { effectiveType: '2g' }, { effectiveType: 'slow-2g' }]) {
      const f = fixture({ positions: [100, 1000] }); await settle();
      equal(f.videos[0].requestedSources.length, 1); equal(f.videos[1].requestedSources.length, 1);
      equal(f.videos[1].attempts.length, 0, 'The second video is only prewarmed');
      f.preferences(restriction); await settle();
      for (const video of f.videos) {
        equal(video.src, '', 'The resource URL must be detached to cancel continued buffering');
        equal(video.currentSrc, '', 'Native load() must run after removing the source');
        equal(video.preload, 'none'); equal(video.paused, true);
        equal(video.loads.at(-1), '', 'The release load must not request another video');
        ok(video.removedAttributes.includes('src'));
      }
      equal(f.playing(), false);
      f.gesture(); f.document.emit('visibilitychange'); f.window.emit('online');
      await f.clock.tick(60000);
      equal(f.videos[0].requestedSources.length, 1); equal(f.videos[0].attempts.length, 1);
      equal(f.videos[1].requestedSources.length, 1); equal(f.videos[1].attempts.length, 0);
      f.preferences({ saveData: false, effectiveType: '4g' }); await settle();
      equal(f.videos[0].requestedSources.length, 2); equal(f.videos[0].paused, false);
      equal(f.playing(), true);
      equal(f.videos[1].requestedSources.length, 2); equal(f.videos[1].attempts.length, 0);
    }
  });

  await test('a released pending play cannot restart downloads or poison a resumed stream', async () => {
    const delayed = fixture({ plans: [['pending']] });
    delayed.preferences({ saveData: true });
    delayed.videos[0].attempts[0].resolve(); await settle();
    equal(delayed.videos[0].paused, true, 'A queued playing event after release must immediately pause again');
    equal(delayed.videos[0].src, ''); equal(delayed.playing(), false);
    equal(delayed.videos[0].requestedSources.length, 1); equal(delayed.videos[0].attempts.length, 1);
    const f = fixture({ plans: [['pending']] });
    const obsolete = f.videos[0].attempts[0];
    f.preferences({ saveData: true }); await settle();
    equal(f.videos[0].src, ''); equal(f.videos[0].paused, true);
    await f.clock.tick(60000);
    equal(f.videos[0].attempts.length, 1); equal(f.videos[0].requestedSources.length, 1);
    f.preferences({ saveData: false }); await settle();
    equal(f.videos[0].attempts.length, 2); equal(f.videos[0].requestedSources.length, 2);
    equal(f.videos[0].paused, false); equal(f.playing(), true);
    obsolete.reject('NotAllowedError'); await settle();
    equal(f.videos[0].paused, false, 'The released generation must not mark new playback as policy-blocked');
    equal(f.playing(), true); equal(f.videos[0].requestedSources.length, 2);
    f.gesture(); await settle();
    equal(f.videos[0].attempts.length, 2, 'A stale rejection must not install a gesture retry for the healthy stream');
  });

  await test('reduced motion pauses a ready clip without discarding or fetching it again', async () => {
    const f = fixture(); await settle();
    const url = f.videos[0].src;
    f.motion(true); await settle();
    equal(f.videos[0].paused, true); equal(f.playing(), false);
    equal(f.videos[0].src, url); equal(f.videos[0].currentSrc, url);
    equal(f.videos[0].removedAttributes.length, 0); equal(f.videos[0].loads.length, 1);
    await f.clock.tick(20000);
    f.motion(false); await settle();
    equal(f.videos[0].paused, false); equal(f.playing(), true);
    equal(f.videos[0].loads.length, 1); equal(f.videos[0].attempts.length, 2);
  });

  await test('source errors exhaust gracefully and an online event recovers', async () => {
    const f = fixture(); await settle();
    for (let index = 0; index < 3; index++) { f.videos[0].emit('error'); await settle(); }
    equal(f.videos[0].loads.length, 3); equal(f.videos[0].paused, true); equal(f.playing(), false);
    f.videos[0].emit('canplay'); f.document.emit('visibilitychange'); await settle();
    equal(f.videos[0].loads.length, 3, 'An exhausted video stays on its poster until a recovery signal');
    f.window.emit('online'); await settle();
    equal(f.videos[0].loads.length, 4); ok(f.videos[0].loads[3].includes('-balanced.mp4'));
    equal(f.videos[0].paused, false); equal(f.playing(), true);
    equal(f.videos[1].loads.length, 0, 'Recovery must not eagerly download a distant second video');
  });

  await test('an unexpected native pause while visible resumes without replacing its buffered source', async () => {
    const f = fixture(); await settle();
    const url = f.videos[0].src;
    f.videos[0].pause(); f.videos[0].emit('pause');
    await f.clock.tick(10000);
    equal(f.videos[0].paused, false, 'A visible ambient video must recover from an unexpected native pause');
    equal(f.playing(), true);
    equal(f.videos[0].src, url); equal(f.videos[0].requestedSources.length, 1);
    equal(f.videos[0].attempts.length, 2, 'Native-pause recovery should make one bounded same-source retry');
  });

  await test('a visible startup AbortError with ready media cannot strand playback', async () => {
    const f = fixture({ plans: [['abort']] });
    f.videos[0].readyState = 4;
    await settle(); await f.clock.tick(10000);
    equal(f.videos[0].paused, false, 'An aborted visible startup needs a bounded retry even when readyState is already high');
    equal(f.playing(), true); equal(f.videos[0].attempts.length, 2);
    equal(f.videos[0].requestedSources.length, 1, 'Abort recovery must reuse the buffered source');
  });

  await test('a ready but unresolved play promise remains recoverable by a user gesture', async () => {
    const f = fixture({ plans: [['pending', 'pending', 'resolve']] });
    f.videos[0].readyState = 4; f.videos[0].emit('canplay');
    await f.clock.tick(20000);
    const automaticAttempts = f.videos[0].attempts.length;
    ok(automaticAttempts <= 2, 'A deferred ready clip gets at most one automatic same-source retry');
    await f.clock.tick(60000);
    equal(f.videos[0].attempts.length, automaticAttempts, 'Automatic recovery must settle instead of retrying forever');
    equal(f.videos[0].requestedSources.length, 1, 'Deferred ready media does not justify downloading another encode');
    f.gesture('pointerup');
    ok(f.videos[0].attempts.length >= 2, 'A ready unresolved play promise must not deduplicate all future retries forever');
    equal(f.videos[0].attempts.at(-1).gesture, true, 'After bounded automatic recovery the next retry must run inside activation');
    await settle(); equal(f.videos[0].paused, false); equal(f.playing(), true);
    equal(f.videos[0].requestedSources.length, 1, 'A policy-deferred play must not cascade through other downloads');
  });

  await test('native-pause recovery stays asleep while hidden or reduced-motion is enabled', async () => {
    for (const restrict of [f => f.hidden(true), f => f.motion(true)]) {
      const f = fixture(); await settle();
      restrict(f); f.videos[0].emit('pause'); await settle();
      const before = f.videos[0].attempts.length;
      await f.clock.tick(60000);
      equal(f.videos[0].paused, true);
      equal(f.videos[0].attempts.length, before, 'The health controller must not fight explicit visibility/motion pauses');
      equal(f.videos[0].requestedSources.length, 1);
      equal(f.clock.jobs.size, 0, 'Restricted media should not keep a recovery timer alive');
    }
  });

  await test('a frozen decoded clock gets one bounded retry, then a gesture can restore real progress', async () => {
    const f = fixture(); await settle(); await f.clock.tick(2000);
    const video = f.videos[0];
    video.freezePlaybackClock();
    const stoppedAt = video.currentTime;
    equal(video.paused, false); equal(video.readyState, 4);
    await f.clock.tick(20000);
    equal(video.currentTime, stoppedAt, 'Decode readiness and playing events alone must not count as progress');
    equal(video.attempts.length, 2, 'Persistent frozen playback gets exactly one automatic same-source retry');
    equal(video.paused, true); equal(f.playing(), false);
    equal(video.requestedSources.length, 1);
    await f.clock.tick(60000); equal(video.attempts.length, 2, 'A frozen decoder must not create an endless retry loop');
    equal(f.clock.jobs.size, 0, 'The blocked clip should stop its health timer while waiting for activation');
    video.resumePlaybackClock(); f.gesture('pointerup'); await settle(); await f.clock.tick(3000);
    equal(video.attempts.length, 3); equal(video.attempts[2].gesture, true);
    equal(video.paused, false); equal(f.playing(), true);
    ok(video.currentTime > stoppedAt, 'The successful retry must advance the media clock');
    equal(video.requestedSources.length, 1);
    // Real progress, rather than another playing event, replenishes the budget.
    video.freezePlaybackClock(); await f.clock.tick(3500);
    equal(video.attempts.length, 4, 'After genuine progress, a later independent freeze can receive one automatic retry');
    equal(video.requestedSources.length, 1);
  });

  await test('late pending rejections cannot poison a healthy same-source recovery', async () => {
    for (const name of ['NotAllowedError', 'NotSupportedError']) {
      const f = fixture({ plans: [['pending', 'resolve']] });
      const video = f.videos[0], abandoned = video.attempts[0];
      video.readyState = 4;
      await f.clock.tick(4000);
      equal(video.attempts.length, 2); equal(video.paused, false); equal(f.playing(), true);
      const url = video.currentSrc;
      abandoned.reject(name); await settle(); f.gesture('click'); await f.clock.tick(3000);
      equal(video.currentSrc, url); equal(video.paused, false); equal(f.playing(), true);
      equal(video.attempts.length, 2, `${name} from an old pending play must not block or retry its healthy replacement`);
      equal(video.requestedSources.length, 1, 'Same-source recovery must isolate old callbacks without an encode download');
    }
  });

  await test('explicit site motion modes override system motion while preserving a ready source', async () => {
    const f = fixture({ reduced: true, motionMode: 'auto' }); await settle();
    equal(f.videos[0].requestedSources.length, 0); equal(f.videos[0].attempts.length, 0);
    f.setMotionMode('on');
    equal(f.videos[0].attempts.length, 1, 'Explicit on must start synchronously even when the system reduces motion');
    equal(f.videos[0].attempts[0].gesture, true);
    await settle(); await f.clock.tick(2000);
    equal(f.videos[0].paused, false); equal(f.playing(), true);
    const url = f.videos[0].src;
    f.setMotionMode('off'); await settle();
    equal(f.videos[0].paused, true); equal(f.playing(), false); equal(f.clock.jobs.size, 0);
    equal(f.videos[0].src, url); equal(f.videos[0].removedAttributes.length, 0);
    await f.clock.tick(60000); equal(f.videos[0].attempts.length, 1);
    f.setMotionMode('on'); await settle();
    equal(f.videos[0].paused, false); equal(f.playing(), true);
    equal(f.videos[0].requestedSources.length, 1, 'Off/on should reuse ready media rather than refetch it');
    f.setMotionMode('auto'); await settle(); equal(f.videos[0].paused, true);
    f.motion(false); await settle(); equal(f.videos[0].paused, false);
    equal(f.videos[0].requestedSources.length, 1);
    const explicitOff = fixture({ motionMode: 'off' }); await settle();
    equal(explicitOff.videos[0].requestedSources.length, 0, 'Explicit off wins even when the system allows motion');
    const explicitOn = fixture({ reduced: true, motionMode: 'on' }); await settle();
    equal(explicitOn.videos[0].paused, false, 'A saved explicit-on choice must work on initial page load too');
    equal(explicitOn.videos[0].requestedSources.length, 1);
  });

  await test('explicit motion on never overrides data-saving or severely restricted-network safeguards', async () => {
    for (const restriction of [{ saveData: true }, { effectiveType: '2g' }, { effectiveType: 'slow-2g' }]) {
      const f = fixture({ reduced: true, motionMode: 'auto', connection: restriction }); await settle();
      f.setMotionMode('on'); await settle();
      equal(f.videos[0].requestedSources.length, 0); equal(f.videos[0].attempts.length, 0);
      f.preferences({ saveData: false, effectiveType: '4g' }); await settle();
      equal(f.videos[0].paused, false); equal(f.playing(), true);
      equal(f.videos[0].requestedSources.length, 1);
      f.preferences(restriction); await settle();
      f.setMotionMode('off'); f.setMotionMode('on'); await settle(); await f.clock.tick(20000);
      equal(f.videos[0].src, ''); equal(f.videos[0].paused, true); equal(f.clock.jobs.size, 0);
      equal(f.videos[0].requestedSources.length, 1, 'A preference-button gesture cannot restart a released restricted stream');
    }
  });

  await test('a site motion-on gesture recovers blocked or abandoned playback on the same source', async () => {
    for (const initial of ['not-allowed', 'pending']) {
      const f = fixture({ reduced: true, motionMode: 'auto', plans: [[initial, 'resolve']] });
      f.setMotionMode('on'); await settle();
      const first = f.videos[0].attempts[0];
      ok(first, 'The first explicit motion-on attempts playback');
      const url = f.videos[0].src;
      f.setMotionMode('off'); f.setMotionMode('on');
      equal(f.videos[0].attempts.length, 2, 'The motion-change event must retry before user activation ends');
      equal(f.videos[0].attempts[1].gesture, true);
      await settle(); equal(f.videos[0].paused, false); equal(f.playing(), true);
      equal(f.videos[0].src, url); equal(f.videos[0].requestedSources.length, 1);
      if (initial === 'pending') {
        first.reject('NotAllowedError'); await settle();
        equal(f.videos[0].paused, false); equal(f.playing(), true);
      }
    }
  });

  if (failures.length) {
    console.error(`FAIL: ${failures.length} of ${cases} ambient-video scenarios; ${assertions} passing assertions.`);
    process.exitCode = 1;
  } else console.log(`PASS: ${cases} ambient-video scenarios; ${assertions} assertions.`);
})().catch(error => { console.error(error); process.exitCode = 1; });

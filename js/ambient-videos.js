(() => {
  'use strict';

  // Pick once when a video is first needed; resizing never restarts a healthy stream.
  function selectVideoQuality(environment = {}) {
    const { width = 1280, coarse = false, memory = 0, cores = 0, downlink = 0, effectiveType = '' } = environment;
    return width <= 800 || coarse || (memory > 0 && memory <= 4) || (cores > 0 && cores <= 4)
      || (downlink > 0 && downlink < 2.5) || effectiveType === '3g' ? 'mobile' : 'balanced';
  }
  function allowsVideo({ reduced = false, saveData = false, effectiveType = '' } = {}) {
    return !reduced && !saveData && effectiveType !== '2g' && effectiveType !== 'slow-2g';
  }
  function sourceChoices(sources, quality, supports) {
    const result = [];
    const add = (url, type) => {
      if (url && supports(type) && !result.some(item => item.url === url)) result.push({ url, type });
    };
    sources.forEach(source => {
      if (quality === 'mobile') add(source.mobile || source.src, source.type);
      else { add(source.src, source.type); add(source.mobile, source.type); }
    });
    return result;
  }
  if (typeof module === 'object' && module.exports) module.exports = { selectVideoQuality, allowsVideo, sourceChoices };
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const videos = [...document.querySelectorAll('[data-ambient-video]')];
  if (!videos.length) return;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const coarsePointer = window.matchMedia?.('(pointer: coarse)');
  const connection = window.navigator?.connection;
  const hasObserver = typeof window.IntersectionObserver === 'function';
  const entries = [];
  const lookup = new WeakMap();
  const permitted = () => allowsVideo({ reduced: !!reducedMotion?.matches, saveData: !!connection?.saveData, effectiveType: connection?.effectiveType });
  const shouldPlay = entry => permitted() && !document.hidden && entry.visible && !entry.failed;
  const quality = () => selectVideoQuality({ width: window.innerWidth, coarse: !!coarsePointer?.matches,
    memory: window.navigator?.deviceMemory, cores: window.navigator?.hardwareConcurrency,
    downlink: connection?.downlink, effectiveType: connection?.effectiveType });

  function showPoster(entry) { entry.surface?.classList.remove('is-playing'); }
  function clearTimers(entry) {
    window.clearTimeout(entry.posterTimer);
    window.clearTimeout(entry.stallTimer);
    window.clearTimeout(entry.healthTimer);
    entry.posterTimer = entry.stallTimer = entry.healthTimer = 0;
  }
  function pause(entry, poster = false) {
    entry.video.autoplay = false;
    entry.video.pause();
    clearTimers(entry);
    if (poster) showPoster(entry);
  }
  function retryReady(entry, gesture = false) {
    // A loaded clip can still have an abandoned play() promise. Invalidate its
    // callbacks and resume the same buffered resource, without another download.
    clearTimers(entry);
    entry.generation++;
    entry.pending = null;
    entry.resumePending = entry.blocked = false;
    entry.quietTicks = 0;
    entry.lastTime = Number(entry.video.currentTime) || 0;
    entry.video.autoplay = false;
    entry.video.pause();
    requestPlay(entry, gesture);
  }
  function watchHealth(entry) {
    if (!shouldPlay(entry) || entry.blocked || entry.healthTimer) return;
    const generation = entry.generation;
    entry.healthTimer = window.setTimeout(() => {
      entry.healthTimer = 0;
      if (generation !== entry.generation || !shouldPlay(entry) || entry.blocked) return;
      const time = Number(entry.video.currentTime) || 0;
      const advancing = Math.abs(time - entry.lastTime) > 0.02;
      entry.lastTime = time;
      if (advancing && !entry.video.paused) {
        entry.quietTicks = entry.readyRetries = 0;
      } else entry.quietTicks++;
      // readyState alone does not prove playback: Chrome may pause a decoded
      // clip, or leave play() pending, without reporting a network/buffer error.
      if (entry.video.readyState >= 3 && (entry.video.paused || entry.quietTicks >= 3)) {
        showPoster(entry);
        if (entry.readyRetries >= 1) {
          entry.blocked = true;
          entry.resumePending = false;
          entry.generation++;
          entry.pending = null;
          pause(entry, true);
          return;
        }
        entry.readyRetries++;
        retryReady(entry);
        return;
      }
      watchHealth(entry);
    }, 1000);
  }
  function watchBuffer(entry) {
    if (!shouldPlay(entry) || entry.blocked || entry.stallTimer) return;
    const generation = entry.generation;
    entry.posterTimer = window.setTimeout(() => {
      entry.posterTimer = 0;
      if (generation === entry.generation && shouldPlay(entry) && entry.video.readyState < 3) showPoster(entry);
    }, 1200);
    entry.stallTimer = window.setTimeout(() => {
      entry.stallTimer = 0;
      if (generation === entry.generation && shouldPlay(entry) && entry.video.readyState < 3) recover(entry);
    }, 8000);
  }
  function loadChoice(entry, index) {
    clearTimers(entry);
    entry.generation++;
    entry.pending = null;
    entry.resumePending = false;
    entry.blocked = false;
    entry.quietTicks = entry.readyRetries = entry.lastTime = 0;
    entry.index = index;
    const choice = entry.choices[index];
    showPoster(entry);
    if (!choice) { entry.failed = true; pause(entry, true); return false; }
    entry.video.autoplay = false;
    entry.video.preload = 'auto';
    entry.video.src = choice.url;
    entry.video.load();
    return true;
  }
  function prepare(entry) {
    if (!permitted() || document.hidden || entry.failed) return false;
    if (entry.loaded) return true;
    entry.choices = sourceChoices(entry.sources, quality(), type => !!entry.video.canPlayType(type));
    entry.loaded = true;
    return loadChoice(entry, 0);
  }
  function recover(entry) {
    // Bounded fallback: desktop MP4 -> lighter MP4 -> supported WebM -> poster.
    if (!permitted() || document.hidden || entry.failed) return;
    if (loadChoice(entry, entry.index + 1) && entry.visible) requestPlay(entry);
  }
  function requestPlay(entry, gesture = false) {
    if (!shouldPlay(entry) || (!gesture && entry.blocked)) return;
    if (!prepare(entry)) return;
    watchHealth(entry);
    if (entry.pending) { entry.resumePending = true; return; }
    if (!entry.video.paused && entry.video.readyState >= 3) return;
    entry.blocked = false;
    entry.video.muted = true;
    entry.video.autoplay = true;
    const generation = entry.generation;
    let attempt;
    try {
      // Keep this call synchronous in touch/click handlers for Safari activation.
      attempt = entry.video.play();
    } catch (error) { rejected(error); return; }
    watchBuffer(entry);
    if (!attempt || typeof attempt.then !== 'function') return;
    const pending = Promise.resolve(attempt);
    entry.pending = pending;
    pending.then(() => {
      if (generation === entry.generation && !shouldPlay(entry)) pause(entry, !permitted());
    }, rejected).then(() => {
      if (entry.pending !== pending) return;
      entry.pending = null;
      if (entry.resumePending && shouldPlay(entry) && !entry.blocked) {
        entry.resumePending = false;
        requestPlay(entry);
      }
    });
    function rejected(error) {
      if (generation !== entry.generation) return;
      if (error?.name === 'NotAllowedError') {
        entry.blocked = true;
        entry.resumePending = false;
        pause(entry, true);
      } else if (error?.name !== 'AbortError' && shouldPlay(entry)) recover(entry);
      // Aborts caused by leaving view are harmless. If still visible, the health
      // check above also covers a ready clip whose aborted start never resumes.
    }
  }
  function sync(entry) {
    if (!shouldPlay(entry)) { pause(entry, !permitted() || entry.failed); return; }
    requestPlay(entry);
  }
  function measureVisibility() {
    const height = window.innerHeight || document.documentElement.clientHeight;
    entries.forEach(entry => {
      const bounds = entry.video.getBoundingClientRect();
      entry.visible = bounds.bottom > 0 && bounds.top < height && bounds.height > 0;
      entry.near = bounds.bottom > -280 && bounds.top < height + 280;
      if (entry.near) prepare(entry);
      sync(entry);
    });
  }

  videos.forEach(video => {
    video.muted = video.defaultMuted = true;
    video.loop = video.playsInline = true;
    video.autoplay = false;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    const sources = [...video.querySelectorAll('source[data-src]')].map(source => ({
      src: source.dataset.src, mobile: source.dataset.srcMobile, type: source.type
    }));
    const entry = { video, sources, surface: video.closest('[data-video-surface]'), visible: false, near: false,
      failed: false, loaded: false, choices: [], index: -1, generation: 0, pending: null, resumePending: false,
      blocked: false, posterTimer: 0, stallTimer: 0, healthTimer: 0, lastTime: 0, quietTicks: 0, readyRetries: 0 };
    entries.push(entry);
    lookup.set(video, entry);
    video.addEventListener('playing', () => {
      if (!shouldPlay(entry)) { pause(entry, !permitted()); return; }
      clearTimers(entry);
      entry.blocked = false;
      entry.surface?.classList.add('is-playing');
      watchHealth(entry);
    });
    video.addEventListener('pause', () => {
      showPoster(entry);
      watchHealth(entry);
    });
    video.addEventListener('waiting', () => watchBuffer(entry));
    video.addEventListener('stalled', () => { if (video.readyState < 3) watchBuffer(entry); });
    video.addEventListener('canplay', () => sync(entry));
    video.addEventListener('error', () => {
      if (!entry.loaded || entry.failed) return;
      recover(entry);
    });
  });

  if (hasObserver) {
    const warmObserver = new window.IntersectionObserver(changes => {
      changes.forEach(change => {
        const entry = lookup.get(change.target);
        if (!entry) return;
        entry.near = change.isIntersecting;
        if (entry.near) prepare(entry);
      });
    }, { rootMargin: '280px 0px', threshold: 0 });
    const playObserver = new window.IntersectionObserver(changes => {
      changes.forEach(change => {
        const entry = lookup.get(change.target);
        if (!entry) return;
        entry.visible = change.isIntersecting;
        sync(entry);
      });
    }, { threshold: 0.01 });
    entries.forEach(entry => { warmObserver.observe(entry.video); playObserver.observe(entry.video); });
  } else {
    // Two videos only; old browsers get coalesced geometry checks, never an idle loop.
    let frame = 0;
    const update = () => {
      if (frame) return;
      const queue = window.requestAnimationFrame || (callback => window.setTimeout(callback, 100));
      frame = queue(() => { frame = 0; measureVisibility(); });
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
  }
  document.addEventListener('visibilitychange', () => entries.forEach(sync));
  window.addEventListener('pageshow', measureVisibility);
  window.addEventListener('online', () => {
    entries.forEach(entry => { if (entry.failed) { entry.failed = false; entry.loaded = false; } });
    measureVisibility();
  });
  function preferenceChange() {
    if (connection?.saveData || connection?.effectiveType === '2g' || connection?.effectiveType === 'slow-2g') {
      entries.forEach(entry => {
        if (!entry.loaded) return;
        pause(entry, true);
        entry.generation++;
        entry.loaded = entry.failed = entry.blocked = entry.resumePending = false;
        entry.pending = null;
        entry.video.preload = 'none';
        entry.video.removeAttribute('src');
        entry.video.load();
      });
    }
    measureVisibility();
  }
  if (reducedMotion?.addEventListener) reducedMotion.addEventListener('change', preferenceChange);
  else reducedMotion?.addListener?.(preferenceChange);
  connection?.addEventListener?.('change', preferenceChange);
  const retryBlocked = () => entries.forEach(entry => {
    if (!shouldPlay(entry) || !(entry.blocked || entry.video.paused || (entry.pending && entry.quietTicks >= 3))) return;
    entry.readyRetries = 0;
    retryReady(entry, true);
  });
  document.addEventListener('pointerup', retryBlocked, { passive: true });
  document.addEventListener('touchend', retryBlocked, { passive: true });
  document.addEventListener('click', retryBlocked, { passive: true });
  document.addEventListener('keydown', retryBlocked);
  measureVisibility();
})();

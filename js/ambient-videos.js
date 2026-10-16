(() => {
  'use strict';
  const videos = [...document.querySelectorAll('[data-ambient-video]')];
  if (!videos.length) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const saveData = Boolean(navigator.connection?.saveData);
  const hasObserver = 'IntersectionObserver' in window;

  const entries = videos.map(video => {
    video.muted = true;
    video.loop = true;
    const sources = [...video.querySelectorAll('source[data-src]')];
    const candidates = sources.filter(source => video.canPlayType(source.type));
    const entry = { video, sources, surface: video.closest('[data-video-surface]'), visible: !hasObserver, failed: !candidates.length, loaded: false };
    const failedSources = new Set();
    function fallback() {
      entry.failed = true;
      video.pause();
      entry.surface?.classList.remove('is-playing');
    }
    candidates.forEach(source => source.addEventListener('error', () => {
      failedSources.add(source);
      if (candidates.every(candidate => failedSources.has(candidate))) fallback();
    }));
    video.addEventListener('error', fallback);
    video.addEventListener('playing', () => entry.surface?.classList.add('is-playing'));
    return entry;
  });

  function shouldPlay(entry) {
    return !entry.failed && entry.visible && !document.hidden && !reducedMotion.matches && !saveData;
  }

  async function sync(entry) {
    if (!shouldPlay(entry)) {
      entry.video.pause();
      return;
    }
    if (!entry.loaded) {
      entry.loaded = true;
      entry.sources.forEach(source => { source.src = source.dataset.src; });
      entry.video.load();
    }
    try {
      await entry.video.play();
      if (!shouldPlay(entry)) entry.video.pause();
    } catch {
      // The poster remains visible when the browser cannot autoplay.
    }
  }

  if (hasObserver) {
    const observer = new IntersectionObserver(changes => {
      changes.forEach(change => {
        const entry = entries.find(item => item.video === change.target);
        if (!entry) return;
        entry.visible = change.isIntersecting;
        sync(entry);
      });
    }, { threshold: 0.08 });
    entries.forEach(entry => observer.observe(entry.video));
  } else {
    entries.forEach(sync);
  }
  document.addEventListener('visibilitychange', () => entries.forEach(sync));
  reducedMotion.addEventListener('change', () => entries.forEach(sync));
})();

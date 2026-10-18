(() => {
  'use strict';

  const normalizeMode = value => ['auto', 'on', 'off'].includes(value) ? value : 'on';
  const motionEnabled = (mode, reduced, saveData = false) => !saveData && (mode === 'on' || (mode !== 'off' && !reduced));
  if (typeof module === 'object' && module.exports) module.exports = { normalizeMode, motionEnabled };
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const key = 'lioravenn-motion-preference';
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const connection = window.navigator?.connection;
  let mode = 'on';
  try { mode = normalizeMode(window.localStorage.getItem(key)); } catch { /* Private browsing can deny storage. */ }
  // Ordinary visits start with motion on. Saved choices and explicit demo-link
  // preferences take precedence over that default.
  if (typeof URLSearchParams === 'function') {
    const requested = new URLSearchParams(window.location?.search || '').get('motion');
    if (['auto', 'on', 'off'].includes(requested)) {
      mode = requested;
      try { window.localStorage.setItem(key, mode); } catch { /* Use this visit's choice. */ }
    }
  }
  let lastEnabled;
  let panel, selector, label, status, copyButton;
  const isEnabled = () => motionEnabled(mode, !!reduced?.matches, !!connection?.saveData);
  function description() {
    if (connection?.saveData) return 'Data saving is enabled on this device. Animations and background videos are paused.';
    if (mode === 'off') return 'Animations and background videos are off. Choose On to enable them.';
    if (mode === 'auto' && reduced?.matches) return 'Your device requests reduced motion. Choose On to enable animations and videos for this website.';
    if (connection?.effectiveType === '2g' || connection?.effectiveType === 'slow-2g') return 'Animations are on. Background videos are paused on this slow connection.';
    return mode === 'on' ? 'Animations and muted background videos are enabled. Your choice applies across this website.' : 'Following your device settings. Animations and muted background videos are enabled.';
  }
  function update(notify = false) {
    const enabled = isEnabled();
    document.documentElement.setAttribute('data-motion-preference', mode);
    document.documentElement.setAttribute('data-motion-enabled', String(enabled));
    if (selector) selector.value = mode;
    if (label) label.textContent = mode === 'auto' ? `Auto · ${enabled ? 'on' : 'off'}` : mode === 'on' ? 'On' : 'Off';
    if (status) status.textContent = description();
    const changed = enabled !== lastEnabled;
    lastEnabled = enabled;
    if (notify || changed) window.dispatchEvent(new window.Event('lioravenn:motion-change'));
  }
  function setMode(value) {
    const next = normalizeMode(value);
    const changed = next !== mode;
    mode = next;
    try { window.localStorage.setItem(key, mode); } catch { /* Preferences still work for this visit. */ }
    // Once the visitor changes the control, an older explicit demo link must
    // not override their newly saved choice the next time they refresh.
    if (typeof URLSearchParams === 'function' && window.history?.replaceState && window.location?.search) {
      const params = new URLSearchParams(window.location.search);
      if (params.has('motion')) {
        params.delete('motion');
        const query = params.toString();
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash || ''}`);
      }
    }
    update(changed);
    return mode;
  }
  window.LioravennMotion = { getMode: () => mode, isEnabled, setMode };
  update();
  const preferenceChanged = () => update();
  if (reduced?.addEventListener) reduced.addEventListener('change', preferenceChanged);
  else reduced?.addListener?.(preferenceChanged);
  connection?.addEventListener?.('change', preferenceChanged);
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    const next = normalizeMode(event.newValue);
    const changed = next !== mode;
    mode = next;
    update(changed);
  });

  function playbackStatus() {
    return JSON.stringify({
      version: '20261019-default-motion',
      motion: mode, enabled: isEnabled(), reducedMotion: !!reduced?.matches,
      saveData: !!connection?.saveData, connection: connection?.effectiveType || 'unknown',
      browser: window.navigator?.userAgent || 'unknown',
      coarsePointer: !!window.matchMedia?.('(pointer: coarse)').matches,
      cores: window.navigator?.hardwareConcurrency || 'unknown',
      viewport: `${window.innerWidth}x${window.innerHeight}`, hidden: document.hidden,
      scrollEffects: document.documentElement.className,
      videos: [...document.querySelectorAll('[data-ambient-video]')].map(video => ({
        id: video.id, paused: video.paused, readyState: video.readyState,
        time: Math.round(video.currentTime * 100) / 100,
        source: video.currentSrc ? video.currentSrc.split('/').pop().split('?')[0] : 'not loaded',
        error: video.error?.code || null
      }))
    }, null, 2);
  }
  function mount() {
    panel = document.createElement('details');
    panel.className = 'motion-settings';
    panel.innerHTML = '<summary>Motion <span data-motion-label></span><span class="motion-toggle" aria-hidden="true">+</span></summary><div class="motion-options"><label for="motion-preference">Website motion</label><select id="motion-preference"><option value="on">On — default</option><option value="auto">Auto — follow device</option><option value="off">Off — still imagery</option></select><p data-motion-status role="status"></p><button type="button" class="motion-copy">Copy playback status</button><p class="motion-copy-note">If motion still stops, copy this status and share it with the website developer.</p></div>';
    document.body.append(panel);
    selector = panel.querySelector('select');
    label = panel.querySelector('[data-motion-label]');
    status = panel.querySelector('[data-motion-status]');
    copyButton = panel.querySelector('.motion-copy');
    selector.addEventListener('change', () => setMode(selector.value));
    copyButton.addEventListener('click', async () => {
      try {
        await window.navigator.clipboard.writeText(playbackStatus());
        copyButton.textContent = 'Status copied';
      } catch {
        copyButton.textContent = 'Select the status below to copy';
        let report = panel.querySelector('textarea');
        if (!report) {
          report = document.createElement('textarea');
          report.readOnly = true;
          report.setAttribute('aria-label', 'Playback status');
          panel.querySelector('.motion-options').append(report);
        }
        report.value = playbackStatus();
        report.focus();
        report.select();
      }
    });
    panel.addEventListener('toggle', () => { if (panel.open) { copyButton.textContent = 'Copy playback status'; update(); } });
    document.addEventListener('click', event => { if (!panel.contains(event.target)) panel.open = false; });
    panel.addEventListener('keydown', event => { if (event.key === 'Escape') { panel.open = false; panel.querySelector('summary').focus(); } });
    update();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();

(() => {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // Motion stays on without a menu or saved preferences. The browser's
  // explicit data-saving setting still pauses resource-intensive effects.
  const connection = window.navigator?.connection;
  const isEnabled = () => !connection?.saveData;
  let lastEnabled = isEnabled();

  window.LioravennMotion = { getMode: () => 'on', isEnabled };

  function update() {
    const enabled = isEnabled();
    document.documentElement.setAttribute('data-motion-preference', 'on');
    document.documentElement.setAttribute('data-motion-enabled', String(enabled));
    const changed = enabled !== lastEnabled;
    lastEnabled = enabled;
    if (changed) window.dispatchEvent(new window.Event('lioravenn:motion-change'));
  }

  update();
  connection?.addEventListener?.('change', update);
})();

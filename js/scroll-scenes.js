(() => {
    'use strict';
    const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, Number.isFinite(value) ? value : low));
    const round = (value, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits || 0;
    function entranceProgress(scrollY, viewportHeight, top, headerHeight = 0) {
        if (![scrollY, viewportHeight, top].every(Number.isFinite) || viewportHeight <= 0) return 1;
        return clamp((scrollY + viewportHeight * .9 - top) / Math.max(1, viewportHeight * .72 - clamp(headerHeight, 0, viewportHeight * .35)));
    }
    function showcaseProgress(scrollY, top, stickyTop, runway) {
        if (![scrollY, top, stickyTop, runway].every(Number.isFinite) || runway <= 0) return 0;
        return clamp((scrollY + stickyTop - top) / runway);
    }
    function deckPose(progress, index, count = 3) {
        const time = clamp(progress) * Math.max(0, count - 1);
        const leave = clamp(time - index);
        const future = clamp(index - time, 0, 2);
        return {
            x: round(-112 * leave + 1.5 * future),
            y: round(14 * future - 28 * leave),
            rotate: round(1.5 * future - 8 * leave),
            scale: round(1 - .035 * future, 4)
        };
    }
    function videoPose(progress) {
        const value = clamp(progress);
        const eased = value * value * (3 - 2 * value);
        return { scale: round(.76 + .24 * eased, 4), radius: round(110 * (1 - eased)), tilt: round(8 * (1 - eased)) };
    }
    if (typeof module === 'object' && module.exports) module.exports = { entranceProgress, showcaseProgress, deckPose, videoPose };
    if (typeof window === 'undefined' || typeof document === 'undefined' || !window.requestAnimationFrame) return;
    const main = document.querySelector('main');
    if (!main) return;
    const welcome = main.querySelector('[data-scroll-scene="shutters"]');
    const aperture = welcome?.querySelector('.sm-visual-frame');
    const showcase = main.querySelector('[data-scroll-scene="showcase"]');
    const track = showcase?.querySelector('.scene-showcase-track');
    const stage = showcase?.querySelector('.scene-showcase-stage');
    const cardWindow = showcase?.querySelector('.scene-showcase-window');
    const cards = Array.from(showcase?.querySelectorAll('.home-unit') || []);
    const counter = showcase?.querySelector('.scene-showcase-count');
    const videoSection = main.querySelector('[data-scroll-scene="video"]');
    const videoAnchor = videoSection?.querySelector('.scene-video-anchor');
    const videoSurface = videoAnchor?.querySelector('.residence-video');
    if (!aperture && !track && !videoSurface) return;
    const root = document.documentElement;
    const connection = window.navigator?.connection;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const writes = new WeakMap();
    let enabled = false;
    let deckEnabled = false;
    let dirty = true;
    let scheduled = 0;
    let viewportHeight = window.innerHeight;
    let headerHeight = 0;
    let stickyTop = 0;
    let runway = 1;
    let apertureTop = 0;
    let trackTop = 0;
    let videoTop = 0;
    let lastCounter = '';

    function write(element, key, value) {
        if (!element) return;
        let previous = writes.get(element);
        if (!previous) { previous = new Map(); writes.set(element, previous); }
        if (previous.get(key) === value) return;
        element.style.setProperty(key, value);
        previous.set(key, value);
    }
    aperture?.classList.add('scene-aperture');
    cards.forEach((card, index) => write(card, '--scene-card-order', String(cards.length - index)));

    function measure() {
        viewportHeight = window.innerHeight || root.clientHeight;
        headerHeight = document.querySelector('.site-header')?.getBoundingClientRect().height || 0;
        stickyTop = headerHeight + 20;
        runway = Math.max(1, Math.round(viewportHeight * 1.8));
        deckEnabled = enabled && viewportHeight >= 640 && cards.length > 1 && !!track && !!stage && !!cardWindow;
        root.classList.toggle('scene-motion-enabled', enabled);
        showcase?.classList.toggle('scene-showcase-active', deckEnabled);
        if (showcase) {
            write(showcase, '--scene-sticky-top', `${stickyTop}px`);
            const reserve = window.innerWidth <= 600 ? 96 : 40;
            write(showcase, '--scene-stage-height', `${clamp(viewportHeight - headerHeight - reserve, 380, 640)}px`);
            write(showcase, '--scene-runway', `${runway}px`);
        }
        const y = window.scrollY || 0;
        // All anchors stay in normal document flow. Never measure the sticky
        // stage, transformed cards or expanding video to derive progress.
        if (aperture) apertureTop = aperture.getBoundingClientRect().top + y;
        if (track) trackTop = track.getBoundingClientRect().top + y;
        if (videoAnchor) videoTop = videoAnchor.getBoundingClientRect().top + y;
        dirty = false;
    }
    function render() {
        scheduled = 0;
        if (dirty) measure();
        if (!enabled) return;
        const y = window.scrollY || 0;
        if (aperture) {
            const value = entranceProgress(y, viewportHeight, apertureTop, headerHeight);
            const eased = value * value * (3 - 2 * value);
            write(aperture, '--scene-shutter-left', `${round(-100 * eased)}%`);
            write(aperture, '--scene-shutter-right', `${round(100 * eased)}%`);
        }
        if (deckEnabled) {
            const active = document.activeElement;
            const focused = cards.findIndex(card => card === active || card.contains(active));
            const value = focused >= 0 ? focused / (cards.length - 1) : showcaseProgress(y, trackTop, stickyTop, runway);
            cards.forEach((card, index) => {
                const pose = deckPose(value, index, cards.length);
                write(card, '--scene-card-x', `${pose.x}%`);
                write(card, '--scene-card-y', `${pose.y}px`);
                write(card, '--scene-card-rotate', `${pose.rotate}deg`);
                write(card, '--scene-card-scale', String(pose.scale));
            });
            write(stage, '--scene-deck-progress', String(round(value, 4)));
            const label = `${String(Math.round(value * (cards.length - 1)) + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
            if (counter && label !== lastCounter) { counter.textContent = label; lastCounter = label; }
            if (focused >= 0) {
                if (cardWindow.scrollLeft) cardWindow.scrollLeft = 0;
                if (cardWindow.scrollTop) cardWindow.scrollTop = 0;
            }
        }
        if (videoSurface) {
            const pose = videoPose(entranceProgress(y, viewportHeight, videoTop, headerHeight));
            write(videoSurface, '--scene-video-scale', String(pose.scale));
            write(videoSurface, '--scene-video-radius', `${pose.radius}px`);
            write(videoSurface, '--scene-video-tilt', `${pose.tilt}deg`);
        }
    }
    function schedule() { if (!scheduled) scheduled = window.requestAnimationFrame(render); }
    function invalidate() { dirty = true; schedule(); }
    function configure() {
        const state = window.LioravennMotion;
        enabled = !connection?.saveData && (typeof state?.isEnabled === 'function' ? state.isEnabled() : !reduced?.matches);
        invalidate();
    }
    window.addEventListener('scroll', () => { if (enabled) schedule(); }, { passive: true });
    window.addEventListener('resize', invalidate, { passive: true });
    window.addEventListener('pageshow', invalidate);
    window.addEventListener('load', invalidate, { once: true });
    window.addEventListener('lioravenn:layout-change', invalidate);
    window.addEventListener('lioravenn:motion-change', configure);
    main.addEventListener('load', invalidate, true);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) invalidate(); });
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
    reduced?.addEventListener?.('change', configure);
    connection?.addEventListener?.('change', configure);
    document.fonts?.ready.then(invalidate);
    configure();
})();

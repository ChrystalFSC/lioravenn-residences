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
    const ease = progress => { const value = clamp(progress); return value * value * (3 - 2 * value); };
    function departureProgress(scrollY, viewportHeight, top, headerHeight = 0) {
        if (![scrollY, viewportHeight, top].every(Number.isFinite) || viewportHeight <= 0) return 0;
        return clamp((scrollY + headerHeight - top) / Math.max(240, viewportHeight * .65));
    }
    function titlePose(progress, index, viewportWidth) {
        const value = ease(progress);
        const direction = index % 2 ? 1 : -1;
        return { x: round(direction * Math.min(180, Math.max(0, viewportWidth) * .2) * value), turn: round(-direction * 2 * value) };
    }
    function artPose(progress, index = 0, kind = 'gallery') {
        const value = ease(progress);
        const remaining = 1 - value;
        const direction = index % 2 ? 1 : -1;
        if (kind === 'hinge') return { x: round(direction * 14 * remaining), y: 0, turn: round(direction * 24 * remaining), scale: round(.92 + .08 * value, 4) };
        if (kind === 'gallery') return { x: round(direction * 8 * remaining), y: round(42 * remaining), turn: round(direction * 6 * remaining), scale: round(1.28 - .28 * value, 4) };
        return { x: 0, y: 0, turn: 0, scale: 1 };
    }
    function fanPose(progress, index, count = 3, kind = 'plans') {
        const value = ease(progress);
        const center = index - (count - 1) / 2;
        const folio = kind === 'folio';
        return { x: round(center * (folio ? 8 + 44 * value : 10 + 94 * value)), y: round(Math.abs(center) * (folio ? 8 - 4 * value : 18 - 12 * value)), turn: round(center * (folio ? 2 + 16 * value : 2 + 7 * value)), scale: 1 };
    }
    function balancePose(progress, index, count) {
        const value = ease(progress);
        const direction = index % 2 ? 1 : -1;
        return { x: round(direction * (1 - value) * 70), y: round((index - (count - 1) / 2) * (20 + 14 * value)), turn: round(direction * (1 - value) * 24), scale: round(.45 + .55 * value, 4) };
    }
    if (typeof module === 'object' && module.exports) module.exports = { entranceProgress, showcaseProgress, deckPose, videoPose, departureProgress, titlePose, artPose, fanPose, balancePose };
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
    const protectedArea = 'form,fieldset,dialog,[role="dialog"],[role="tabpanel"],[role="status"],[aria-live],#site-plan-explorer,.finance-section,.viewing-form-column,.brochure-workspace,#brochure-preview';
    const titles = Array.from(main.querySelectorAll('[data-scroll-scene="title"]')).filter(element => !element.closest(protectedArea)).map(element => ({ element, lines: Array.from(element.querySelectorAll('.scene-title-line')), top: 0 }));
    const artworks = Array.from(main.querySelectorAll('[data-scene-art]')).filter(element => !element.closest(protectedArea)).map((element, index) => {
        const kind = element.getAttribute('data-scene-art');
        const art = { element, kind, index, parts: Array.from(element.querySelectorAll('[data-scene-part]')), owner: element.closest('button,a') || element, top: 0, visible: false, layer: null, curtains: null };
        if (['hinge', 'gallery', 'shutters-vertical'].includes(kind)) {
            const image = element.querySelector('img');
            if (image) {
                const frame = document.createElement('div');
                frame.className = 'scene-art-window';
                const layer = document.createElement('div');
                layer.className = 'scene-art-layer';
                image.replaceWith(frame);
                layer.append(image);
                frame.append(layer);
                art.layer = layer;
                if (kind === 'shutters-vertical') {
                    const curtains = document.createElement('div');
                    curtains.className = 'scene-art-curtains';
                    curtains.setAttribute('aria-hidden', 'true');
                    frame.append(curtains);
                    art.curtains = curtains;
                }
            }
        }
        return art;
    });
    if (!aperture && !track && !videoSurface && !titles.length && !artworks.length) return;
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
        titles.forEach(title => { title.top = title.element.getBoundingClientRect().top + y; });
        artworks.forEach(art => {
            const bounds = art.element.getBoundingClientRect();
            art.top = bounds.top + y;
            art.visible = bounds.width > 0 && bounds.height > 0 && !art.element.closest('[hidden]');
        });
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
        titles.forEach(title => {
            const progress = departureProgress(y, viewportHeight, title.top, headerHeight);
            title.lines.forEach((line, index) => {
                const pose = titlePose(progress, index, window.innerWidth);
                write(line, '--scene-title-x', `${pose.x}px`);
                write(line, '--scene-title-turn', `${pose.turn}deg`);
            });
        });
        const active = document.activeElement;
        artworks.forEach(art => {
            if (!art.visible) return;
            const focused = active && active !== document.body && (art.owner === active || art.owner.contains(active));
            const progress = focused ? 1 : art.kind === 'balance' ? departureProgress(y, viewportHeight, art.top, headerHeight) : entranceProgress(y, viewportHeight, art.top, headerHeight);
            if (art.layer) {
                const pose = artPose(progress, art.index, art.kind);
                write(art.layer, '--scene-art-x', `${pose.x}%`);
                write(art.layer, '--scene-art-y', `${pose.y}px`);
                write(art.layer, '--scene-art-turn', `${pose.turn}deg`);
                write(art.layer, '--scene-art-scale', String(pose.scale));
            }
            if (art.curtains) {
                write(art.curtains, '--scene-curtain-before', `${round(-100 * ease(progress))}%`);
                write(art.curtains, '--scene-curtain-after', `${round(100 * ease(progress))}%`);
            }
            art.parts.forEach((part, index) => {
                const pose = art.kind === 'balance' ? balancePose(progress, index, art.parts.length) : fanPose(progress, index, art.parts.length, art.kind);
                write(part, '--scene-part-x', `${pose.x}%`);
                write(part, '--scene-part-y', `${pose.y}px`);
                write(part, '--scene-part-turn', `${pose.turn}deg`);
                write(part, '--scene-part-scale', String(pose.scale));
            });
            if (art.kind === 'balance') {
                write(art.element, '--scene-monogram-y', `${round(-140 * ease(progress))}px`);
                write(art.element, '--scene-monogram-turn', `${round(18 * ease(progress))}deg`);
            }
            if (art.kind === 'folio') write(art.element, '--scene-book-open', `${round(-65 * ease(progress))}deg`);
        });
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
    if (typeof window.ResizeObserver === 'function') {
        let lastSize = null;
        const observer = new window.ResizeObserver(entries => {
            const size = entries?.[0]?.contentRect;
            if (!size) return;
            const changed = lastSize && (Math.abs(size.width - lastSize.width) > 1 || Math.abs(size.height - lastSize.height) > 1);
            lastSize = { width: size.width, height: size.height };
            if (changed) invalidate();
        });
        observer.observe(main);
    }
    document.fonts?.ready.then(invalidate);
    configure();
})();

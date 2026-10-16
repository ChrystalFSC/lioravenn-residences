(() => {
    'use strict';

    const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, Number.isFinite(value) ? value : low));
    const scrollProgress = (scrollY, pageHeight, viewportHeight) => pageHeight > viewportHeight ? clamp(scrollY / (pageHeight - viewportHeight)) : 0;
    function activeChapterIndex(starts, scrollY, viewportHeight, scrollLimit) {
        if (!starts.length) return -1;
        if (scrollY <= 1) return 0;
        if (scrollLimit > 0 && scrollY >= scrollLimit - 2) return starts.length - 1;
        const readingLine = scrollY + viewportHeight * .36;
        let active = 0;
        starts.forEach((start, index) => { if (start <= readingLine) active = index; });
        return active;
    }
    function heroMotion(scrollY, top, height, headerHeight, light = false) {
        const progress = height > 0 ? clamp((scrollY - top + headerHeight) / height) : 0;
        return { y: Math.round(progress * (light ? 10 : 42) * 100) / 100, opacity: Math.round((1 - progress * (light ? .1 : .34)) * 1000) / 1000 };
    }
    function visualOffset(scrollY, viewportHeight, top, height, amplitude = 18) {
        const travel = (viewportHeight + height) / 2;
        return travel > 0 ? Math.round(clamp((scrollY + viewportHeight / 2 - top - height / 2) / travel, -1, 1) * amplitude * 100) / 100 : 0;
    }
    if (typeof module === 'object' && module.exports) module.exports = { clamp, scrollProgress, activeChapterIndex, heroMotion, visualOffset };
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const main = document.querySelector('main');
    if (!main || typeof window.requestAnimationFrame !== 'function') return;

    const root = document.documentElement;
    const isHome = document.body.classList.contains('home-page');
    const reducedQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const lightQuery = window.matchMedia?.('(max-width: 800px)');
    const connection = window.navigator?.connection;
    const hero = isHome ? main.querySelector('.home-hero') : null;
    const heroCopy = hero?.querySelector('.hero-copy');
    const records = [];
    const lookup = new WeakMap();
    const visualLayers = [];
    const chapters = [];
    let observer = null;
    let scheduled = 0;
    let needsMeasure = true;
    let motionEnabled = false;
    let viewportHeight = window.innerHeight;
    let pageHeight = 0;
    let headerHeight = 96;
    let heroBounds = null;
    let lastChapter = -1;
    let chapterNav = null;
    let chapterButton = null;
    let chapterList = null;
    let lastProgress = -1;

    const progress = document.createElement('div');
    progress.className = 'sm-scroll-progress';
    progress.setAttribute('aria-hidden', 'true');
    const progressFill = document.createElement('span');
    progressFill.className = 'sm-scroll-progress-fill';
    progress.append(progressFill);
    document.body.append(progress);

    function ensureId(element, preferred) {
        if (element.id) return element.id;
        let id = preferred;
        let suffix = 2;
        while (document.getElementById(id)) id = `${preferred}-${suffix++}`;
        element.id = id;
        return id;
    }
    if (isHome) {
        [
            ['.home-hero', 'Intro', 'chapter-intro'],
            ['.welcome-section', 'Philosophy', 'chapter-philosophy'],
            ['.collection-section', 'Homes', 'chapter-homes'],
            ['.lifestyle-section', 'Lifestyle', 'chapter-lifestyle'],
            ['.residence-motion', 'In motion', 'chapter-film'],
            ['.explore-banner', 'Interiors', 'chapter-interiors'],
            ['.next-chapter', 'Next chapter', 'chapter-next']
        ].forEach(([selector, label, id]) => {
            const element = main.querySelector(selector);
            if (element) chapters.push({ element, label, id: ensureId(element, id), top: 0 });
        });
        if (chapters.length > 1) {
            chapterNav = document.createElement('nav');
            chapterNav.className = 'sm-chapters';
            chapterNav.setAttribute('aria-label', 'Page chapters');
            chapterNav.innerHTML = `<button type="button" class="sm-chapter-current" aria-expanded="false" aria-controls="sm-chapter-list"><span class="sm-chapter-current-number">01</span><span class="sm-chapter-current-label">Intro</span><span class="sm-chapter-toggle" aria-hidden="true">+</span></button><ol class="sm-chapter-list" id="sm-chapter-list" hidden>${chapters.map((chapter, index) => `<li><a href="#${chapter.id}"><span>${String(index + 1).padStart(2, '0')}</span>${chapter.label}</a></li>`).join('')}</ol>`;
            document.body.append(chapterNav);
            chapterButton = chapterNav.querySelector('.sm-chapter-current');
            chapterList = chapterNav.querySelector('.sm-chapter-list');
            chapters.forEach((chapter, index) => { chapter.link = chapterList.querySelectorAll('a')[index]; });
            const closeChapters = () => {
                chapterButton.setAttribute('aria-expanded', 'false');
                chapterList.hidden = true;
                chapterNav.querySelector('.sm-chapter-toggle').textContent = '+';
            };
            chapterButton.addEventListener('click', () => {
                const open = chapterButton.getAttribute('aria-expanded') !== 'true';
                chapterButton.setAttribute('aria-expanded', String(open));
                chapterList.hidden = !open;
                chapterNav.querySelector('.sm-chapter-toggle').textContent = open ? '−' : '+';
            });
            chapterList.addEventListener('click', event => {
                const link = event.target.closest('a');
                const chapter = chapters.find(item => item.link === link);
                if (!chapter) return;
                closeChapters();
                // Native anchors keep browser history, scrolling and reduced-motion behavior.
                if (!chapter.element.hasAttribute('tabindex')) chapter.element.setAttribute('tabindex', '-1');
                window.setTimeout(() => chapter.element.focus({ preventScroll: true }), 0);
            });
            document.addEventListener('click', event => { if (!chapterNav.contains(event.target)) closeChapters(); });
            document.addEventListener('keydown', event => {
                if (event.key === 'Escape' && chapterNav.contains(document.activeElement) && !chapterList.hidden) {
                    closeChapters();
                    chapterButton.focus();
                }
            });
        }

        // Only these two still images get a moving inner layer. Their captions,
        // seal and neighbouring links retain the original layout and transforms.
        ['.welcome-visual > img', '.explore-image > img'].forEach(selector => {
            const image = main.querySelector(selector);
            if (!image) return;
            const frame = document.createElement('div');
            frame.className = 'sm-visual-frame';
            const layer = document.createElement('div');
            layer.className = 'sm-visual-layer';
            image.replaceWith(frame);
            layer.append(image);
            frame.append(layer);
            visualLayers.push({ frame, layer, top: 0, height: 0 });
        });
        heroCopy?.classList.add('sm-hero-copy');
    }

    const excluded = 'form,fieldset,dialog,[role="dialog"],[role="tabpanel"],[aria-live],[role="status"],[role="alert"],[hidden],[aria-hidden="true"],button,details,.brochure-workspace,#brochure-preview,.brochure-preview-column,#site-plan-explorer,.finance-section,.comparison-section,.viewing-section,.finder-filters,.finder-empty,.unit-card,.collection-toolbar,.room-story,.room-tabs,.hero-copy,.small-print,.collection-note,.finder-disclaimer,.site-plan-disclaimer,.life-disclaimer,.finder-sr-only,.sr-only,[data-motion="off"]';
    const sectionCounts = new WeakMap();
    function addRecord(element, image = false) {
        if (lookup.has(element) || element.closest(excluded)) return;
        if (!image && (element.closest('a') || element.querySelector('a,button,input,select,textarea,[contenteditable="true"]'))) return;
        if (records.some(record => !record.image && record.element.contains(element))) return;
        const bounds = element.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        const section = element.closest('section') || main;
        const order = sectionCounts.get(section) || 0;
        sectionCounts.set(section, order + 1);
        const record = { element, image };
        records.push(record);
        lookup.set(element, record);
        element.classList.add(image ? 'sm-image-reveal' : 'sm-reveal');
        element.style.setProperty('--sm-delay', `${Math.min(order % 3 * 45, 90)}ms`);
    }
    main.querySelectorAll('.facts-inner > div,.life-values > article').forEach(element => addRecord(element));
    main.querySelectorAll('h1,h2,h3,p').forEach(element => addRecord(element));
    main.querySelectorAll('.sm-visual-frame,.home-unit-image,.lifestyle-tile > img,.life-intro-image > img,.life-story-image > img,.life-closing > img').forEach(element => addRecord(element, true));

    function hasFocus(element) {
        const active = document.activeElement;
        return active && active !== document.body && (element === active || element.contains(active) || active.contains(element));
    }
    function setReveal(record, visible, bounds) {
        const focused = hasFocus(record.element);
        record.element.classList.toggle('sm-visible', visible || focused);
        record.element.style.setProperty('--sm-enter-y', bounds.top < 0 ? '-20px' : '26px');
    }
    function configureMotion() {
        motionEnabled = !reducedQuery?.matches && !connection?.saveData;
        root.classList.toggle('sm-reduced', !motionEnabled);
        root.classList.remove('sm-enhanced');
        observer?.disconnect();
        if (motionEnabled && typeof window.IntersectionObserver === 'function') {
            observer = new window.IntersectionObserver(entries => {
                entries.forEach(entry => {
                    const record = lookup.get(entry.target);
                    if (record) setReveal(record, entry.isIntersecting, entry.boundingClientRect);
                });
            }, { threshold: 0, rootMargin: '0px' });
            records.forEach(record => {
                const bounds = record.element.getBoundingClientRect();
                setReveal(record, bounds.bottom > 0 && bounds.top < window.innerHeight, bounds);
                observer.observe(record.element);
            });
            root.classList.add('sm-enhanced');
        } else records.forEach(record => record.element.classList.add('sm-visible'));
        invalidate();
    }
    function measure() {
        viewportHeight = window.innerHeight || root.clientHeight;
        const y = window.scrollY || 0;
        pageHeight = Math.max(root.scrollHeight, document.body.scrollHeight, viewportHeight);
        headerHeight = document.querySelector('.site-header')?.getBoundingClientRect().height || 0;
        chapters.forEach(chapter => { chapter.top = chapter.element.getBoundingClientRect().top + y; });
        if (hero) {
            const bounds = hero.getBoundingClientRect();
            heroBounds = { top: bounds.top + y, height: bounds.height };
        }
        visualLayers.forEach(visual => {
            const bounds = visual.frame.getBoundingClientRect();
            visual.top = bounds.top + y;
            visual.height = bounds.height;
        });
        needsMeasure = false;
    }
    function renderFrame() {
        scheduled = 0;
        if (needsMeasure) measure();
        const y = window.scrollY || 0;
        const fraction = scrollProgress(y, pageHeight, viewportHeight);
        if (fraction !== lastProgress) {
            progressFill.style.transform = `scaleX(${fraction.toFixed(5)})`;
            lastProgress = fraction;
        }
        if (chapterNav) {
            const index = activeChapterIndex(chapters.map(chapter => chapter.top), y, viewportHeight, pageHeight - viewportHeight);
            if (index !== lastChapter && chapters[index]) {
                lastChapter = index;
                const chapter = chapters[index];
                chapters.forEach((item, current) => {
                    if (current === index) item.link.setAttribute('aria-current', 'location');
                    else item.link.removeAttribute('aria-current');
                });
                chapterNav.querySelector('.sm-chapter-current-number').textContent = String(index + 1).padStart(2, '0');
                chapterNav.querySelector('.sm-chapter-current-label').textContent = chapter.label;
                chapterButton.setAttribute('aria-label', `Page chapters. Current: ${String(index + 1).padStart(2, '0')}, ${chapter.label}. Show or hide chapters.`);
            }
        }
        const light = !!lightQuery?.matches;
        if (heroCopy && heroBounds) {
            const state = motionEnabled ? heroMotion(y, heroBounds.top, heroBounds.height, headerHeight, light) : { y: 0, opacity: 1 };
            heroCopy.style.setProperty('--sm-hero-y', `${state.y}px`);
            heroCopy.style.setProperty('--sm-hero-opacity', String(state.opacity));
        }
        visualLayers.forEach(visual => {
            const offset = motionEnabled ? visualOffset(y, viewportHeight, visual.top, visual.height, light ? 4 : 18) : 0;
            visual.layer.style.setProperty('--sm-image-y', `${offset}px`);
        });
    }
    function schedule() {
        if (!scheduled) scheduled = window.requestAnimationFrame(renderFrame);
    }
    function invalidate() { needsMeasure = true; schedule(); }

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', invalidate, { passive: true });
    window.addEventListener('load', invalidate, { once: true });
    window.addEventListener('pageshow', invalidate);
    window.addEventListener('lioravenn:layout-change', invalidate);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) invalidate(); });
    document.addEventListener('focusin', () => {
        records.forEach(record => {
            if (hasFocus(record.element)) {
                record.element.classList.add('sm-visible', 'sm-focus-held');
            }
        });
    });
    document.addEventListener('focusout', () => window.requestAnimationFrame(() => {
        records.forEach(record => { if (!hasFocus(record.element)) record.element.classList.remove('sm-focus-held'); });
    }));
    if (typeof window.ResizeObserver === 'function') {
        const resizeObserver = new window.ResizeObserver(invalidate);
        resizeObserver.observe(main);
        resizeObserver.observe(document.body);
    }
    if (reducedQuery?.addEventListener) reducedQuery.addEventListener('change', configureMotion);
    else reducedQuery?.addListener?.(configureMotion);
    if (lightQuery?.addEventListener) lightQuery.addEventListener('change', invalidate);
    else lightQuery?.addListener?.(invalidate);
    connection?.addEventListener?.('change', configureMotion);
    document.fonts?.ready.then(invalidate);
    configureMotion();
})();

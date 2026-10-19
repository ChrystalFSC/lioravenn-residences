// Run: node tests/scroll-motion.test.cjs
// Dependency-free math and DOM lifecycle checks. Browser QA covers visual
// composition, actual browser rendering and native anchor scrolling.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/scroll-motion.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/scroll-motion.css'), 'utf8');
const { clamp, scrollProgress, activeChapterIndex, heroMotion, visualOffset, allowsContinuousMotion, overlapsViewport, edgeMotion } = require(path.join(root, 'js/scroll-motion.js'));
let checks = 0;
function equal(actual, expected, reason) { assert.deepEqual(actual, expected, reason); checks++; }
equal(clamp(-1), 0); equal(clamp(2), 1); equal(clamp(NaN), 0);
equal(scrollProgress(500, 2000, 1000), .5);
equal(scrollProgress(-100, 2000, 1000), 0);
equal(scrollProgress(5000, 2000, 1000), 1);
equal(scrollProgress(0, 700, 900), 0);
equal(activeChapterIndex([], 0, 900, 5000), -1);
equal(activeChapterIndex([96, 900, 1700], 0, 900, 5000), 0);
equal(activeChapterIndex([96, 900, 1700], 1500, 900, 5000), 2);
equal(activeChapterIndex([96, 900, 1700], 700, 900, 5000), 1);
equal(activeChapterIndex([96, 900, 1700], 4999, 900, 5000), 2);
equal(heroMotion(0, 96, 600, 96), { y: 0, opacity: 1 });
equal(heroMotion(300, 96, 600, 96), { y: 21, opacity: .83 });
equal(heroMotion(2000, 96, 600, 96), { y: 42, opacity: .66 });
equal(heroMotion(2000, 96, 600, 96, true), { y: 10, opacity: .9 });
equal(heroMotion(100, 0, 0, 0), { y: 0, opacity: 1 });
equal(visualOffset(500, 1000, 750, 500), 0);
equal(visualOffset(0, 1000, 3000, 500), -18);
equal(visualOffset(5000, 1000, 0, 500), 18);
equal(visualOffset(5000, 1000, 0, 500, 4), 4);
equal(visualOffset(0, 0, 0, 0), 0);
equal(allowsContinuousMotion({ cores: 8, memory: 8 }), true);
for (const restricted of [{ reduced: true }, { saveData: true }, { narrow: true }, { coarse: true }, { touchPoints: 1 }, { cores: 4 }, { memory: 4 }]) equal(allowsContinuousMotion(restricted), false);
equal(allowsContinuousMotion(), true, 'Unavailable device hints alone do not classify a desktop as weak');
equal(overlapsViewport(100, 200, 0, 900), true);
equal(overlapsViewport(1000, 200, 0, 900), false);
equal(overlapsViewport(0, 200, 201, 900), false);
equal(edgeMotion(0, 1000, 1000, 100), { opacity: .38, y: 24 });
equal(edgeMotion(0, 1000, 890, 100), { opacity: .69, y: 12 }, 'Bottom-edge progress has a stable partial state');
equal(edgeMotion(0, 1000, 400, 100), { opacity: 1, y: 0 }, 'The central reading region is fully visible');
equal(edgeMotion(0, 1000, 10, 100), { opacity: .69, y: -12 }, 'Top-edge progress reverses the same restrained shift');
equal(edgeMotion(0, 1000, -100, 100), { opacity: .38, y: -24 });
equal(edgeMotion(0, 1000, -500, 1600), { opacity: 1, y: 0 }, 'Long content remains readable while its middle fills the viewport');
equal(edgeMotion(0, 1000, 1000, 100, 0, .62, 0), { opacity: .62, y: 0 }, 'Images can retain a higher visible floor without translation');
equal(edgeMotion(0, 1000, 1000, 100, 0, .38, 100).y, 28, 'Translations stay within the restrained maximum');
equal(edgeMotion(0, 0, 100, 100), { opacity: 1, y: 0 });
equal(edgeMotion(0, 1000, 100, 0), { opacity: 1, y: 0 });
equal(edgeMotion(NaN, 1000, 100, 100), { opacity: 1, y: 0 }, 'Invalid geometry fails open');
const mathPositions = [0, 500, 610, 720, 1000, 1380, 1490, 1600, 3000];
const mathStates = mathPositions.map(y => edgeMotion(y, 1000, 1500, 100));
[...mathPositions].reverse().forEach((y, index) => equal(edgeMotion(y, 1000, 1500, 100), mathStates.at(-1 - index), 'Scroll direction does not change a position-derived state'));
for (let y = 0; y <= 2000; y += 50) {
    const state = edgeMotion(y, 600, 1000, 350, 80);
    assert(state.opacity >= .38 && state.opacity <= 1 && Math.abs(state.y) <= 24, 'Small mobile viewports keep content partially visible at every edge'); checks++;
}

class Element {
    constructor(tag, engine, attrs = {}, bounds = {}) {
        this.tagName = tag.toUpperCase(); this.engine = engine; this.attrs = { ...attrs };
        this.children = []; this.parentNode = null; this.listeners = {}; this.styleWrites = [];
        const node = this;
        this.style = { setProperty(key, value) { node.styleWrites.push([key, value]); this[key] = value; } };
        let transform;
        Object.defineProperty(this.style, 'transform', { get() { return transform; }, set(value) { node.styleWrites.push(['transform', value]); transform = value; } });
        this.bounds = { top: 0, width: 500, height: 60, ...bounds }; this.hidden = 'hidden' in attrs;
        this.className = attrs.class || '';
        this.classList = {
            add: (...names) => names.forEach(name => this.classes.add(name)),
            remove: (...names) => names.forEach(name => this.classes.delete(name)),
            contains: name => this.classes.has(name),
            toggle: (name, value) => { const on = value === undefined ? !this.classes.has(name) : value; if (on) this.classes.add(name); else this.classes.delete(name); return on; }
        };
    }
    set className(value) { this.classes = new Set(value.split(/\s+/).filter(Boolean)); }
    get className() { return [...this.classes].join(' '); }
    set id(value) { this.attrs.id = value; }
    get id() { return this.attrs.id || ''; }
    append(...nodes) { nodes.forEach(node => { node.parentNode = this; this.children.push(node); }); }
    replaceWith(node) {
        const index = this.parentNode.children.indexOf(this);
        this.parentNode.children[index] = node; node.parentNode = this.parentNode; node.bounds = { ...this.bounds }; this.parentNode = null;
    }
    all() { return this.children.flatMap(child => [child, ...child.all()]); }
    contains(node) { return this === node || this.all().includes(node); }
    simpleMatch(selector) {
        let valid = true;
        const stripped = selector.replace(/\[([^=\]]+)(?:="([^"]*)")?\]/g, (_, key, value) => { valid &&= Object.hasOwn(this.attrs, key) && (value === undefined || this.attrs[key] === value); return ''; });
        const tag = stripped.match(/^[a-z][\w-]*/i)?.[0];
        if (tag && this.tagName !== tag.toUpperCase()) return false;
        for (const match of stripped.matchAll(/\.([\w-]+)/g)) if (!this.classes.has(match[1])) return false;
        for (const match of stripped.matchAll(/#([\w-]+)/g)) if (this.id !== match[1]) return false;
        return valid;
    }
    matches(selector) {
        return selector.split(',').some(part => {
            const chain = part.trim().split(/\s*>\s*/);
            return chain.length === 1 ? this.simpleMatch(chain[0]) : this.simpleMatch(chain.at(-1)) && !!this.parentNode?.matches(chain.slice(0, -1).join(' > '));
        });
    }
    closest(selector) { let node = this; while (node) { if (node.matches(selector)) return node; node = node.parentNode; } return null; }
    querySelectorAll(selector) { return this.all().filter(node => node.matches(selector)); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    setAttribute(key, value) { if (key === 'class') this.className = String(value); else this.attrs[key] = String(value); }
    getAttribute(key) { return this.attrs[key] ?? null; }
    removeAttribute(key) { delete this.attrs[key]; }
    hasAttribute(key) { return Object.hasOwn(this.attrs, key); }
    addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
    emit(name, event = {}) { (this.listeners[name] || []).forEach(callback => callback(event)); }
    focus() { this.engine.document.activeElement = this; }
    getBoundingClientRect() {
        this.engine.geometryReads++;
        const enhanced = this.engine.document?.documentElement.classList.contains('sm-enhanced');
        const shift = enhanced && this.classes.has('sm-shift-reveal') && !this.classes.has('sm-focus-held') ? parseFloat(this.style['--sm-y']) || 0 : 0;
        const top = this.bounds.top - this.engine.window.scrollY + shift;
        return { ...this.bounds, top, bottom: top + this.bounds.height };
    }
    set innerHTML(markup) {
        this.children = [];
        const stack = [this];
        for (const match of markup.matchAll(/<(\/?)([a-z][\w-]*)([^>]*)>/gi)) {
            if (match[1]) { stack.pop(); continue; }
            const attrs = {};
            for (const attr of match[3].matchAll(/([^\s=]+)(?:="([^"]*)")?/g)) attrs[attr[1]] = attr[2] ?? '';
            const node = new Element(match[2], this.engine, attrs); stack.at(-1).append(node);
            if (!['img', 'br', 'input', 'source'].includes(match[2])) stack.push(node);
        }
    }
}

function fixture({ home = true, reduced = false, io = true, raf = true, narrow = false, coarse = false, touchPoints = 0, cores = 8, memory = 8, ioThrows = false, transformedCopy = false, transformedHero = false, motionMode = 'on', resizeObserver = true } = {}) {
    const engine = { observers: [], resizeObservers: [], frames: new Map(), timers: [], nextFrame: 1, geometryReads: 0 };
    const media = matches => ({ matches, callbacks: [], addEventListener(name, callback) { this.callbacks.push(callback); }, change(value) { this.matches = value; this.callbacks.forEach(callback => callback()); } });
    engine.reduce = media(reduced); engine.narrow = media(narrow); engine.coarse = media(coarse);
    engine.connection = { saveData: false, callbacks: [], addEventListener(name, callback) { this.callbacks.push(callback); }, change(value) { this.saveData = value; this.callbacks.forEach(callback => callback()); } };
    const events = {};
    engine.window = {
        scrollY: 0, innerHeight: 900, innerWidth: narrow ? 390 : 1440,
        navigator: { connection: engine.connection, maxTouchPoints: touchPoints, hardwareConcurrency: cores, deviceMemory: memory },
        matchMedia: query => query.includes('reduced-motion') ? engine.reduce : query.includes('coarse') ? engine.coarse : engine.narrow,
        getComputedStyle: node => ({ transform: node.existingTransform || 'none' }),
        addEventListener(name, callback) { (events[name] ||= []).push(callback); },
        setTimeout(callback) { engine.timers.push(callback); },
        requestAnimationFrame: raf ? callback => { const id = engine.nextFrame++; engine.frames.set(id, callback); return id; } : undefined
    };
    const html = new Element('html', engine), body = new Element('body', engine, { class: home ? 'home-page' : 'brochure-page' });
    if (motionMode !== null) {
        engine.motionMode = motionMode;
        html.setAttribute('data-motion-preference', motionMode);
        engine.window.LioravennMotion = {
            getMode: () => engine.motionMode,
            isEnabled: () => engine.motionMode === 'on' || (engine.motionMode !== 'off' && !engine.reduce.matches)
        };
    }
    html.append(body); html.scrollHeight = body.scrollHeight = 6500; html.clientHeight = 900;
    body.bounds.height = 6500;
    const documentEvents = {};
    engine.document = {
        documentElement: html, body, activeElement: body,
        createElement: tag => new Element(tag, engine),
        querySelector: selector => html.querySelector(selector),
        getElementById: id => html.all().find(node => node.id === id) || null,
        addEventListener(name, callback) { (documentEvents[name] ||= []).push(callback); }
    };
    const create = (tag, parent, attrs = {}, bounds = {}) => { const node = new Element(tag, engine, attrs, bounds); parent.append(node); return node; };
    const header = create('header', body, { class: 'site-header' }, { height: 96 });
    const main = create('main', body, { id: 'main-content' }, { height: 6000 });
    engine.main = main;
    if (home) {
        const configurations = [['home-hero', 96, 660], ['residence-facts', 756, 150], ['welcome-section', 906, 800, 'welcome'], ['collection-section', 1706, 900], ['lifestyle-section', 2606, 900], ['residence-motion', 3506, 1000, 'lifestyle'], ['explore-banner', 4506, 600], ['next-chapter', 5106, 500]];
        engine.sections = configurations.map(([className, top, height, id]) => create('section', main, { class: className, ...(id ? { id } : {}) }, { top, height }));
        const hero = engine.sections[0];
        engine.heroCopy = create('div', hero, { class: 'hero-copy' }, { top: 180, height: 450 });
        if (transformedHero) engine.heroCopy.existingTransform = 'matrix(1,0,0,1,5,0)';
        create('h1', engine.heroCopy, {}, { top: 230 });
        const heroActions = create('div', engine.heroCopy, { class: 'hero-actions' });
        engine.cta = create('a', heroActions, { href: 'floor-plans.html', class: 'btn' });
        engine.video = create('video', hero, { id: 'hero-video' });
        Object.assign(engine.video, { autoplay: true, muted: true, loop: true, controls: false });
        const facts = create('div', engine.sections[1], { class: 'facts-inner' });
        create('div', facts, {}, { top: 800 });
        const welcomeVisual = create('div', engine.sections[2], { class: 'welcome-visual' });
        engine.welcomeImage = create('img', welcomeVisual, { src: 'still.webp' }, { top: 1000, height: 450 });
        engine.seal = create('div', welcomeVisual, { class: 'welcome-seal' });
        engine.heading = create('h2', engine.sections[2], {}, { top: 1050, height: 120 });
        engine.heading.textContent = 'Space for the life you want to live.';
        if (transformedCopy) engine.heading.existingTransform = 'matrix(1,0,0,1,3,0)';
        create('p', engine.sections[2], {}, { top: 1200 });
        const homeUnit = create('a', engine.sections[3], { class: 'home-unit', href: 'floor-plans.html?unit=type-b' }, { top: 1900, height: 500 });
        engine.card = homeUnit;
        engine.cardImage = create('div', homeUnit, { class: 'home-unit-image' }, { top: 1900, height: 250 });
        create('img', engine.cardImage, {}, { top: 1900, height: 250 });
        engine.cardTitle = create('h3', homeUnit, {}, { top: 2200 });
        create('h2', engine.sections[4], {}, { top: 2700 });
        const tile = create('a', engine.sections[4], { class: 'lifestyle-tile', href: 'gallery.html' });
        create('img', tile, {}, { top: 2800, height: 400 });
        create('h2', engine.sections[5], {}, { top: 3600 });
        const exploreImage = create('div', engine.sections[6], { class: 'explore-image' });
        create('img', exploreImage, {}, { top: 4506, height: 570 });
        create('h2', engine.sections[6], {}, { top: 4600 });
        create('h2', engine.sections[7], {}, { top: 5200 });
    } else create('h1', create('section', main, { class: 'page-intro' }), {}, { top: 200 });
    const form = create('form', main, { id: 'test-form' });
    engine.formHeading = create('h2', form, {}, { top: 800 });
    engine.input = create('input', form, { name: 'amount', value: '100' });
    const tool = create('div', main, { id: 'site-plan-explorer' });
    engine.toolCopy = create('p', tool, {}, { top: 1800 });
    const workspace = create('section', main, { class: 'brochure-workspace' });
    engine.preview = create('div', workspace, { id: 'brochure-preview' });
    engine.previewHeading = create('h2', engine.preview, {}, { top: 2500 });
    engine.protectedCopy = create('p', engine.preview, {}, { top: 2700 });
    const dialog = create('dialog', main);
    engine.dialogHeading = create('h2', dialog, {}, { top: 600 });
    if (io) engine.window.IntersectionObserver = class {
        constructor(callback, options) { if (ioThrows) throw new Error('Observer unavailable'); this.callback = callback; this.options = options; this.targets = []; this.unobserved = []; engine.observers.push(this); }
        observe(node) { this.targets.push(node); }
        unobserve(node) { this.unobserved.push(node); this.targets = this.targets.filter(target => target !== node); }
        disconnect() { this.disconnected = true; this.targets = []; }
        emit(node, visible, rect = node.getBoundingClientRect()) { this.callback([{ target: node, isIntersecting: visible, boundingClientRect: rect }]); }
    };
    if (resizeObserver) engine.window.ResizeObserver = class {
        constructor(callback) { this.callback = callback; this.targets = []; engine.resizeObservers.push(this); }
        observe(node) { this.targets.push(node); }
        emit() { this.callback(this.targets.map(target => ({ target, contentRect: { width: target.bounds.width, height: target.bounds.height } }))); }
    };
    engine.window.MutationObserver = class { constructor() { throw new Error('Dynamic preview must not be observed for reveals'); } };
    vm.runInNewContext(source, { window: engine.window, document: engine.document });
    engine.resizeObservers.forEach(observer => observer.emit());
    engine.flush = () => { const callbacks = [...engine.frames.values()]; engine.frames.clear(); callbacks.forEach(callback => callback()); };
    engine.trigger = name => (events[name] || []).forEach(callback => callback({ type: name }));
    engine.setMotion = mode => {
        engine.motionMode = mode;
        html.setAttribute('data-motion-preference', mode);
        engine.trigger('lioravenn:motion-change');
        engine.flush();
    };
    engine.documentEvent = name => (documentEvents[name] || []).forEach(callback => callback());
    engine.scroll = y => { engine.window.scrollY = y; engine.trigger('scroll'); engine.flush(); };
    engine.flush();
    return engine;
}

function state(node) {
    return { opacity: Number(node.style['--sm-opacity'] ?? 1), y: parseFloat(node.style['--sm-y']) || 0 };
}
function expected(engine, node, image = false) {
    return edgeMotion(engine.window.scrollY, engine.window.innerHeight, node.bounds.top, node.bounds.height, 96, image ? .62 : .38);
}
const f = fixture();
equal(f.main.querySelectorAll('.sm-visual-frame').length, 2, 'Only two homepage still images receive parallax wrappers');
equal(f.welcomeImage.parentNode.className, 'sm-visual-layer');
equal(f.seal.parentNode.className, 'welcome-visual', 'Decorative seal retains its original positioning parent');
equal(f.cta.parentNode.className, 'hero-actions', 'Hero CTA retains its original layout');
equal(f.cta.getAttribute('href'), 'floor-plans.html');
equal([f.video.autoplay, f.video.muted, f.video.loop, f.video.controls], [true, true, true, false], 'Ambient video settings remain untouched');
equal(f.video.parentNode, f.sections[0], 'Video is not wrapped or moved');
equal(f.sections[2].id, 'welcome', 'Existing chapter ID is preserved');
equal(f.sections[5].id, 'lifestyle', 'Existing lifestyle section ID is preserved');
equal(f.observers.length, 0, 'Editorial motion does not depend on IntersectionObserver');
const nav = f.document.body.querySelector('.sm-chapters');
const links = nav.querySelectorAll('a');
equal(links.length, 7, 'Seven readable native chapter links are created');
equal(nav.getAttribute('aria-label'), 'Page chapters');
equal(links.filter(link => link.getAttribute('aria-current') === 'location').length, 1);
f.scroll(2000);
equal(nav.querySelector('.sm-chapter-current-label').textContent, 'Homes');
f.scroll(1000);
equal(nav.querySelector('.sm-chapter-current-label').textContent, 'Philosophy', 'Chapter state reverses on upward scrolling');
f.trigger('scroll'); f.trigger('scroll'); f.trigger('scroll');
equal(f.frames.size, 1, 'Scroll events are coalesced into one animation frame');
f.flush(); equal(f.frames.size, 0, 'No endless requestAnimationFrame loop runs while idle');

const positions = [150, 220, 350, 500, 900, 1000, 1150];
const descending = new Map();
for (const y of positions) {
    f.scroll(y);
    const current = state(f.heading);
    equal(current, expected(f, f.heading), 'Actual DOM styles follow cached document geometry on the way down');
    descending.set(y, current);
}
equal(descending.get(150), { opacity: .38, y: 24 }, 'Entering copy is partially visible with a restrained downward offset');
equal(descending.get(500), { opacity: 1, y: 0 }, 'Copy is fully opaque in the reading area');
equal(descending.get(1150), { opacity: .38, y: -24 }, 'Exiting copy has the mirrored top-edge state');
for (const y of [...positions].reverse()) {
    f.scroll(y);
    equal(state(f.heading), descending.get(y), 'Upward scrolling returns the actual DOM styles to exactly the same position-derived state');
}
f.scroll(5000); f.scroll(220);
equal(state(f.heading), descending.get(220), 'A large jump back into view computes the correct state without an entry event');
f.scroll(500); f.scroll(0); f.scroll(500);
equal(state(f.heading), { opacity: 1, y: 0 }, 'Repeated visits do not accumulate translations or stale fades');
equal(f.heading.textContent, 'Space for the life you want to live.', 'Motion never rewrites editorial text');

const beforeLayoutState = state(f.heading);
f.trigger('lioravenn:layout-change'); f.flush();
equal(state(f.heading), beforeLayoutState, 'Layout refresh subtracts the active transform before caching geometry');
f.scroll(220);
const shiftedLayoutState = state(f.heading);
f.trigger('lioravenn:layout-change'); f.flush();
equal(state(f.heading), shiftedLayoutState, 'Refreshing layout while translated cannot drift the cached top');
f.heading.bounds.top += 120;
f.trigger('lioravenn:layout-change'); f.flush();
equal(state(f.heading), expected(f, f.heading), 'A real layout change refreshes the cached position');
f.heading.bounds.top -= 120;
f.main.emit('load'); f.flush();
equal(state(f.heading), shiftedLayoutState, 'Later image loads can refresh layout without an observer');

equal(f.card.classList.contains('sm-reveal'), false, 'Interactive card itself remains immediately usable');
equal(f.cardTitle.classList.contains('sm-reveal'), false, 'Interactive card text is never animated');
f.scroll(1100);
equal(state(f.cardImage).opacity < 1, true, 'Card imagery may fade partially near an edge');
f.document.activeElement = f.card;
f.documentEvent('focusin'); f.flush();
equal(state(f.cardImage).opacity, 1, 'Keyboard focus forces card imagery fully visible');
equal(f.cardImage.classList.contains('sm-focus-held'), true);
f.document.activeElement = f.heading;
f.documentEvent('focusin'); f.flush();
equal(state(f.heading), { opacity: 1, y: 0 }, 'Focused editorial content stays fully visible at the viewport edge');
f.document.activeElement = f.document.body;
f.documentEvent('focusout'); f.flush(); f.flush();
equal(state(f.heading), expected(f, f.heading), 'Leaving focus restores the current scroll-position state');
for (const protectedNode of [f.formHeading, f.input, f.toolCopy, f.previewHeading, f.protectedCopy, f.dialogHeading]) {
    equal(protectedNode.classList.contains('sm-reveal'), false, 'Tools, forms, dialogs and dynamic preview are excluded');
}
f.preview.innerHTML = '<section><h2>A freshly rendered brochure</h2><p>Always usable.</p></section>';
f.document.documentElement.scrollHeight = f.document.body.scrollHeight = 7500;
f.document.body.bounds.height = 7500;
f.resizeObservers[0].emit(); f.flush();
equal(f.preview.querySelectorAll('.sm-reveal').length, 0, 'Brochure rerender does not register new motion targets');
equal(f.document.body.querySelector('.sm-scroll-progress-fill').style.transform, 'scaleX(0.16667)', 'Progress remeasures a changed document height');

const desktop = fixture();
desktop.scroll(100);
const heroWrites = desktop.heroCopy.styleWrites.length;
const frameReads = desktop.geometryReads;
const headingWrites = desktop.heading.styleWrites.length;
desktop.trigger('scroll'); desktop.flush();
equal(desktop.heroCopy.styleWrites.length, heroWrites, 'An unchanged visible hero receives no duplicate style writes');
equal(desktop.heading.styleWrites.length, headingWrites, 'Unchanged editorial states receive no duplicate style writes');
equal(desktop.geometryReads, frameReads, 'Ordinary scroll does not remeasure geometry');
desktop.scroll(1500);
const offscreenHeroWrites = desktop.heroCopy.styleWrites.length;
const distantHeading = desktop.sections.at(-1).querySelector('h2');
equal(distantHeading.styleWrites.length, 0, 'Distant editorial nodes receive no initial or per-scroll writes');
desktop.scroll(1600);
equal(desktop.heroCopy.styleWrites.length, offscreenHeroWrites, 'Offscreen hero is not updated');
const farLayer = desktop.main.querySelectorAll('.sm-visual-layer')[1];
equal(farLayer.styleWrites.length, 0, 'Offscreen image parallax layers receive no scroll transforms');
const progressFill = desktop.document.body.querySelector('.sm-scroll-progress-fill');
const progressWrites = progressFill.styleWrites.length;
desktop.trigger('scroll'); desktop.flush();
equal(progressFill.styleWrites.length, progressWrites, 'Progress writes only when its formatted value changes');
desktop.resizeObservers[0].emit(); desktop.resizeObservers[0].emit();
equal(desktop.frames.size, 0, 'Unchanged ResizeObserver entries do not start a layout loop');
const beforeBigJumpReads = desktop.geometryReads;
desktop.scroll(5000); desktop.scroll(200);
equal(desktop.geometryReads, beforeBigJumpReads, 'Large scroll jumps also use cached geometry');
equal(state(desktop.heading), expected(desktop, desktop.heading));

const transformed = fixture({ transformedCopy: true, transformedHero: true });
transformed.scroll(220);
equal(transformed.heading.classList.contains('sm-shift-reveal'), false, 'Existing text transforms are preserved through a fade-only fallback');
equal(transformed.heading.style['--sm-y'], undefined, 'The renderer never writes a competing translation');
equal(state(transformed.heading).opacity, expected(transformed, transformed.heading).opacity);
equal(transformed.heroCopy.classList.contains('sm-hero-copy'), false, 'An existing hero transform is never overwritten');
for (const options of [{ narrow: true }, { coarse: true }, { touchPoints: 1 }, { cores: 4 }, { memory: 4 }]) {
    const limited = fixture(options);
    limited.scroll(220);
    equal(limited.document.documentElement.classList.contains('sm-static-effects'), true, 'Limited devices keep only the extra parallax disabled');
    equal(limited.heroCopy.style['--sm-hero-y'], '0px');
    equal(limited.heroCopy.style['--sm-hero-opacity'], '1');
    equal(limited.document.documentElement.classList.contains('sm-enhanced'), true, 'Limited devices retain reversible editorial motion');
    const firstState = state(limited.heading);
    limited.scroll(500); limited.scroll(220);
    equal(state(limited.heading), firstState, 'Reversible text motion works on narrow, touch and low-powered devices');
    equal(limited.document.body.querySelector('.sm-scroll-progress-fill').style.transform !== 'scaleX(0.00000)', true);
}
const phone = fixture({ narrow: true, coarse: true, touchPoints: 1 });
phone.scroll(220);
const beforeToolbarReads = phone.geometryReads;
phone.window.innerHeight = 960;
phone.trigger('resize');
phone.document.body.bounds.height += 60;
phone.main.bounds.height += 60;
phone.document.documentElement.scrollHeight = phone.document.body.scrollHeight = 6560;
phone.resizeObservers[0].emit(); phone.flush();
equal(phone.geometryReads, beforeToolbarReads, 'A mobile toolbar height-only resize does not walk section geometry');
equal(state(phone.heading), expected(phone, phone.heading), 'Toolbar height changes still update edge progress');
phone.main.bounds.height += 800;
phone.document.body.bounds.height += 800;
phone.resizeObservers[0].emit(); phone.flush();
equal(phone.geometryReads > beforeToolbarReads, true, 'A real content-size change still refreshes geometry');
phone.coarse.change(false); phone.window.navigator.maxTouchPoints = 0;
phone.narrow.change(false); phone.window.innerWidth = 1440;
phone.trigger('resize'); phone.flush();
equal(phone.document.documentElement.classList.contains('sm-static-effects'), false, 'Capability changes can restore desktop parallax');
const beforeWidthReads = phone.geometryReads;
phone.window.innerWidth = 1300; phone.trigger('resize'); phone.flush();
equal(phone.geometryReads > beforeWidthReads, true, 'Width changes remeasure potentially rewrapped text');

const dataSaver = fixture();
dataSaver.scroll(220);
const beforeSaving = state(dataSaver.heading);
dataSaver.connection.change(true); dataSaver.flush();
equal(dataSaver.document.documentElement.classList.contains('sm-reduced'), true, 'Live Save Data suppresses all motion');
equal(dataSaver.document.documentElement.classList.contains('sm-enhanced'), false);
equal(state(dataSaver.heading), { opacity: 1, y: 0 }, 'Data saving restores fully visible copy');
equal(dataSaver.heroCopy.style['--sm-hero-y'], '0px');
equal(dataSaver.main.querySelectorAll('.sm-visual-layer').map(layer => layer.style['--sm-image-y']), ['0px', '0px']);
dataSaver.scroll(500); dataSaver.scroll(220);
equal(state(dataSaver.heading), { opacity: 1, y: 0 }, 'Disabled effects remain still during scrolling');
dataSaver.connection.change(false); dataSaver.flush();
equal(state(dataSaver.heading), beforeSaving, 'Resuming motion recomputes the current reversible state');
const enabledByDefault = fixture({ reduced: true });
equal(enabledByDefault.document.documentElement.classList.contains('sm-enhanced'), true, 'The shared default-On contract enables the requested motion');
const fallbackReduced = fixture({ reduced: true, motionMode: null });
equal(fallbackReduced.document.documentElement.classList.contains('sm-enhanced'), false, 'Without the shared contract OS reduced motion remains a safe fallback');
equal(state(fallbackReduced.heading), { opacity: 1, y: 0 });
fallbackReduced.reduce.change(false); fallbackReduced.flush();
equal(state(fallbackReduced.heading), expected(fallbackReduced, fallbackReduced.heading));
const disabledContract = fixture({ motionMode: 'off' });
equal(state(disabledContract.heading), { opacity: 1, y: 0 }, 'A disabled shared contract leaves all content visible');
disabledContract.setMotion('on'); disabledContract.scroll(220);
equal(state(disabledContract.heading), expected(disabledContract, disabledContract.heading), 'The shared event recomputes motion without a reload');
const noIO = fixture({ io: false }); noIO.scroll(220);
equal(state(noIO.heading), expected(noIO, noIO.heading), 'The renderer works when IntersectionObserver is unavailable');
const noRO = fixture({ resizeObserver: false }); noRO.scroll(220);
noRO.heading.bounds.top += 100; noRO.trigger('lioravenn:layout-change'); noRO.flush();
equal(state(noRO.heading), expected(noRO, noRO.heading), 'Explicit layout events work without ResizeObserver');
const noEnhancement = fixture({ raf: false });
equal(noEnhancement.main.querySelectorAll('.sm-reveal').length, 0);
equal(noEnhancement.document.body.querySelectorAll('.sm-scroll-progress').length, 0, 'Unsupported enhancement exits without hiding content');
const brochure = fixture({ home: false });
equal(brochure.document.body.querySelectorAll('.sm-chapters').length, 0);
equal(brochure.main.querySelectorAll('.sm-visual-frame').length, 0);
equal(brochure.previewHeading.classList.contains('sm-reveal'), false);

assert(css.includes('opacity: var(--sm-opacity,1)')); checks++;
assert(css.includes('transition-property: transform'), 'Image opacity follows scroll directly while existing hover transforms can retain their transition'); checks++;
assert(css.includes('translateY(var(--sm-y,0px))')); checks++;
assert(!css.includes('sm-visible') && !css.includes('transition-delay'), 'Scroll-position effects do not depend on one-shot visibility or time-based transitions'); checks++;
assert(css.includes('html:not([data-motion-preference="on"]) .sm-reveal')); checks++;
assert(css.includes('html[data-motion-preference="off"] .sm-reveal')); checks++;
assert(css.includes('@media(prefers-reduced-motion:reduce)')); checks++;
assert(css.includes('@media(max-width:1279px) { .sm-chapters { display: none; } }')); checks++;
assert(!css.includes('filter: blur') && !css.includes('scroll-snap') && !css.includes('clip-path')); checks++;
assert(!/\btranslate\s*:/.test(css), 'Individual translate is not required'); checks++;
assert(!css.includes('will-change'), 'Editorial nodes are not permanently promoted to GPU layers'); checks++;
assert(!source.includes('IntersectionObserver') && !source.includes('readThrough'), 'The implementation has no one-shot observer or read-history state'); checks++;
console.log('Scroll motion: ' + checks + ' helper and DOM lifecycle assertions passed.');

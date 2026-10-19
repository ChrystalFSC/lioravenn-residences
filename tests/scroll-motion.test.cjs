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
const { clamp, scrollProgress, activeChapterIndex, heroMotion, visualOffset, allowsContinuousMotion, overlapsViewport, edgeMotion, headingLineMotion, imageScale } = require(path.join(root, 'js/scroll-motion.js'));
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
equal(heroMotion(300, 96, 600, 96), { y: 32, opacity: .79 });
equal(heroMotion(2000, 96, 600, 96), { y: 64, opacity: .58 });
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
equal(edgeMotion(0, 1000, 1000, 100), { opacity: .08, y: 48 });
equal(edgeMotion(0, 1000, 790, 100), { opacity: .54, y: 24 }, 'The broader bottom band has a visible halfway state');
equal(edgeMotion(0, 1000, 400, 100), { opacity: 1, y: 0 }, 'The central reading region is fully visible');
equal(edgeMotion(0, 1000, 110, 100), { opacity: .54, y: -24 }, 'The top band mirrors the bottom band at the same progress');
equal(edgeMotion(0, 1000, -100, 100), { opacity: .08, y: -48 });
equal(edgeMotion(0, 1000, -500, 1600), { opacity: 1, y: 0 }, 'Long content remains readable while its middle fills the viewport');
equal(edgeMotion(0, 1000, 1000, 100, 0, .24, 0), { opacity: .24, y: 0 }, 'Images retain their own higher opacity floor without translation');
equal(edgeMotion(0, 1000, 1000, 100, 0, .08, 100).y, 56, 'Explicit translations stay within the approved maximum');
equal(edgeMotion(0, 300, 210, 100), { opacity: .54, y: 24 }, 'Short viewports retain a 180px minimum transition band');
equal(edgeMotion(0, 1800, 1590, 100), { opacity: .54, y: 24 }, 'Tall viewports cap the transition band at 420px');
equal(edgeMotion(0, 1000, 811, 100, 100), { opacity: .54, y: 24 }, 'The transition band accounts for the fixed-header inset');
equal(edgeMotion(0, 0, 100, 100), { opacity: 1, y: 0 });
equal(edgeMotion(0, 1000, 100, 0), { opacity: 1, y: 0 });
equal(edgeMotion(NaN, 1000, 100, 100), { opacity: 1, y: 0 }, 'Invalid geometry fails open');
const mathPositions = [0, 500, 610, 720, 1000, 1380, 1490, 1600, 3000];
const mathStates = mathPositions.map(y => edgeMotion(y, 1000, 1500, 100));
[...mathPositions].reverse().forEach((y, index) => equal(edgeMotion(y, 1000, 1500, 100), mathStates.at(-1 - index), 'Scroll direction does not change a position-derived state'));
for (let y = 0; y <= 2000; y += 50) {
    const state = edgeMotion(y, 600, 1000, 350, 80);
    assert(state.opacity >= .08 && state.opacity <= 1 && Math.abs(state.y) <= 48, 'Small mobile viewports retain the full reversible transition without exceeding its bounds'); checks++;
}

// Every line is derived from the heading's shared geometry, rather than an
// entry event or a timer. Reversed scrolling must reproduce the same stagger.
equal(headingLineMotion(0, 1000, 1000, 180, 0, 0, 3), { opacity: .08, y: 34 }, 'An entering heading line starts at its quiet baseline');
equal(headingLineMotion(0, 1000, 790, 100, 0, 0, 2), { opacity: .54, y: 17 }, 'The leading line is halfway through the broad entry band');
const staggeredEntry = headingLineMotion(0, 1000, 790, 100, 0, 1, 2);
assert(staggeredEntry.opacity > .08 && staggeredEntry.opacity < .54 && staggeredEntry.y > 17 && staggeredEntry.y < 34, 'Later lines enter gently behind the leading line'); checks++;
equal(headingLineMotion(0, 1000, 110, 100, 0, 1, 2), { opacity: .54, y: -17 }, 'The final line leads the reversed top-edge exit');
const staggeredExit = headingLineMotion(0, 1000, 110, 100, 0, 0, 2);
assert(staggeredExit.opacity < .54 && staggeredExit.y < -17, 'The first line leaves ahead of the final line'); checks++;
for (let index = 0; index < 3; index++) equal(headingLineMotion(0, 1000, 400, 180, 0, index, 3), { opacity: 1, y: 0 }, 'All lines remain fully readable in the central region');
equal(headingLineMotion(0, 1000, 790, 100, 0, 3, 5), headingLineMotion(0, 1000, 790, 100, 0, 4, 5), 'Long headings cap the accumulated line delay');
equal(headingLineMotion(NaN, 1000, 400, 100, 0, 0, 2), { opacity: 1, y: 0 }, 'Invalid line geometry fails open');
const linePositions = [0, 210, 350, 600, 1000, 1180, 1390, 1600];
const lineStates = linePositions.map(y => [0, 1, 2].map(index => headingLineMotion(y, 1000, 1000, 180, 80, index, 3)));
[...linePositions].reverse().forEach((y, position) => equal([0, 1, 2].map(index => headingLineMotion(y, 1000, 1000, 180, 80, index, 3)), lineStates.at(-1 - position), 'Heading stagger is exactly reversible at the same document position'));
for (let y = 0; y <= 2000; y += 50) {
    const states = [0, 1, 2].map(index => headingLineMotion(y, 600, 1000, 210, 80, index, 3));
    assert(states.every(item => item.opacity >= .08 && item.opacity <= 1 && Math.abs(item.y) <= 34), 'Every mobile heading line stays within its opacity and translation limits'); checks++;
}
equal(imageScale(0, 900, 1000, 450), 1.065, 'An unvisited image begins at a small, bounded crop');
equal(imageScale(1450, 900, 1000, 450), 1, 'Image zoom reaches its original scale after crossing the viewport');
equal(imageScale(0, 0, 1000, 450), 1, 'Invalid image viewport geometry fails open');
const scalePositions = [0, 150, 400, 775, 1100, 1450, 2000];
const scales = scalePositions.map(y => imageScale(y, 900, 1000, 450));
assert(scales.every((scale, index) => scale >= 1 && scale <= 1.065 && (!index || scale <= scales[index - 1])), 'Image zoom remains bounded and settles gradually throughout a viewport traversal'); checks++;
[...scalePositions].reverse().forEach((y, index) => equal(imageScale(y, 900, 1000, 450), scales.at(-1 - index), 'Image zoom reverses without accumulating a scale'));

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

function fixture({ home = true, reduced = false, io = true, raf = true, narrow = false, coarse = false, touchPoints = 0, cores = 8, memory = 8, ioThrows = false, transformedCopy = false, transformedHero = false, motionMode = 'on', resizeObserver = true, lineHeadings = false } = {}) {
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
    const createLineHeading = (parent, attrs, bounds, texts) => {
        const heading = create('h2', parent, attrs, bounds);
        texts.forEach((text, index) => {
            const line = create('span', heading, { class: 'sm-heading-line' }, { top: bounds.top + index * 44, height: 44 });
            line.textContent = text;
            if (index === texts.length - 1) {
                const emphasis = create('em', line);
                emphasis.textContent = text;
                heading.originalEmphasis = emphasis;
            }
        });
        heading.originalLines = [...heading.children];
        return heading;
    };
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
        if (lineHeadings) {
            engine.lineHeading = createLineHeading(engine.sections[2], { id: 'line-heading', 'aria-describedby': 'line-caption' }, { top: 1280, height: 132 }, ['A home should give you', 'more than a place to live.', 'It should give you room to feel.']);
            if (transformedCopy) engine.lineHeading.existingTransform = 'matrix(1,0,0,1,3,0)';
            engine.twoLineHeading = createLineHeading(engine.sections[4], {}, { top: 2800, height: 88 }, ['The luxury of', 'everyday rituals.']);
            engine.eyebrow = create('p', engine.sections[2], { class: 'eyebrow' }, { top: 1240, height: 28 });
            engine.eyebrow.textContent = 'Considered living';
            engine.heroEyebrow = create('p', engine.heroCopy, { class: 'eyebrow' }, { top: 200, height: 28 });
        }
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
    } else {
        const intro = create('section', main, { class: 'page-intro' });
        create('h1', intro, {}, { top: 200 });
        if (lineHeadings) engine.lineHeading = createLineHeading(intro, {}, { top: 600, height: 88 }, ['A considered place.', 'A personal beginning.']);
    }
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
    if (lineHeadings) {
        engine.excludedLineHeadings = [form, tool, engine.preview, dialog].map((parent, index) => createLineHeading(parent, {}, { top: 900 + index * 300, height: 88 }, ['Always ready', 'to use.']));
        const disabledMotion = create('div', main, { 'data-motion': 'off' });
        engine.excludedLineHeadings.push(createLineHeading(disabledMotion, {}, { top: 700, height: 88 }, ['Keep this', 'still.']));
        engine.excludedEyebrow = create('p', form, { class: 'eyebrow' }, { top: 700, height: 28 });
    }
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
    return edgeMotion(engine.window.scrollY, engine.window.innerHeight, node.bounds.top, node.bounds.height, 96, image ? .24 : .08);
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
equal(descending.get(150), { opacity: .08, y: 48 }, 'Entering copy starts at a clearly distinguishable edge state');
equal(descending.get(500), { opacity: 1, y: 0 }, 'Copy is fully opaque in the reading area');
equal(descending.get(1150), { opacity: .08, y: -48 }, 'Exiting copy has the mirrored top-edge state');
for (const y of [...positions].reverse()) {
    f.scroll(y);
    equal(state(f.heading), descending.get(y), 'Upward scrolling returns the actual DOM styles to exactly the same position-derived state');
}
f.scroll(5000); f.scroll(220);
equal(state(f.heading), descending.get(220), 'A large jump back into view computes the correct state without an entry event');
f.scroll(500); f.scroll(0); f.scroll(500);
equal(state(f.heading), { opacity: 1, y: 0 }, 'Repeated visits do not accumulate translations or stale fades');
equal(f.heading.textContent, 'Space for the life you want to live.', 'Motion never rewrites editorial text');

const edgeLifecycle = fixture();
equal(state(edgeLifecycle.heading), { opacity: .08, y: 48 }, 'Copy starts at its edge baseline before its first viewport visit');
equal(state(edgeLifecycle.cardImage).opacity, .24, 'Offscreen imagery receives its distinct baseline immediately');
equal(edgeLifecycle.cardImage.style['--sm-y'], undefined, 'Image fades never overwrite the card image hover transform');
edgeLifecycle.scroll(500);
equal(state(edgeLifecycle.heading), { opacity: 1, y: 0 });
const beforeExitWrites = edgeLifecycle.heading.styleWrites.length;
const beforeExitReads = edgeLifecycle.geometryReads;
edgeLifecycle.scroll(5000);
equal(state(edgeLifecycle.heading), { opacity: .08, y: -48 }, 'A page-sized jump settles formerly readable copy on the correct exit edge');
equal(edgeLifecycle.heading.styleWrites.length > beforeExitWrites, true);
const afterExitWrites = edgeLifecycle.heading.styleWrites.length;
edgeLifecycle.scroll(5100); edgeLifecycle.scroll(5200); edgeLifecycle.trigger('scroll'); edgeLifecycle.flush();
equal(edgeLifecycle.heading.styleWrites.length, afterExitWrites, 'Distant exit states are settled once, without repeated idle writes');
equal(edgeLifecycle.geometryReads, beforeExitReads, 'Large jumps and distant frames reuse cached geometry');
edgeLifecycle.scroll(0);
equal(state(edgeLifecycle.heading), { opacity: .08, y: 48 }, 'Jumping from fully above to fully below updates the edge even without passing through near range');
const beforeIdleEntry = edgeLifecycle.heading.styleWrites.length;
edgeLifecycle.scroll(0); edgeLifecycle.trigger('scroll'); edgeLifecycle.flush();
equal(edgeLifecycle.heading.styleWrites.length, beforeIdleEntry);
const bypassed = fixture();
bypassed.scroll(5000);
equal(state(bypassed.heading), { opacity: .08, y: -48 }, 'A first jump that skips the whole section still applies its exit baseline');

const chapterFocus = fixture();
chapterFocus.scroll(220);
chapterFocus.document.activeElement = chapterFocus.sections[2];
chapterFocus.documentEvent('focusin'); chapterFocus.flush();
equal(state(chapterFocus.heading), expected(chapterFocus, chapterFocus.heading), 'Native chapter-anchor focus on a section must not freeze all of its headings');
equal(chapterFocus.heading.classList.contains('sm-focus-held'), false);
chapterFocus.document.activeElement = chapterFocus.sections[0];
chapterFocus.documentEvent('focusin'); chapterFocus.flush(); chapterFocus.scroll(330);
equal(chapterFocus.heroCopy.style['--sm-hero-y'], '32px', 'Focusing the hero section does not suppress motion of its descendants');
equal(chapterFocus.heroCopy.style['--sm-hero-opacity'], '0.79');
const focusChild = new Element('span', chapterFocus, { tabindex: '0' });
chapterFocus.heading.append(focusChild); focusChild.focus();
chapterFocus.documentEvent('focusin'); chapterFocus.flush();
equal(state(chapterFocus.heading), { opacity: 1, y: 0 }, 'A truly focused descendant still keeps its editorial container readable');
chapterFocus.document.activeElement = chapterFocus.document.body;
chapterFocus.documentEvent('focusout'); chapterFocus.flush(); chapterFocus.flush();
equal(state(chapterFocus.heading), expected(chapterFocus, chapterFocus.heading), 'Blur returns focused content to its current position-derived state');

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
equal(state(f.cardImage).opacity, expected(f, f.cardImage, true).opacity, 'Focusing an ancestor link does not lock its image at full opacity');
equal(f.cardImage.classList.contains('sm-focus-held'), false);
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
equal(state(distantHeading), { opacity: .08, y: 48 }, 'Distant editorial content receives its correct baseline immediately');
const distantWrites = distantHeading.styleWrites.length;
assert(distantWrites > 0, 'Offscreen content must not start at an uninitialised full-opacity state'); checks++;
desktop.scroll(1600);
equal(distantHeading.styleWrites.length, distantWrites, 'Distant content on the same edge receives no repeated style writes');
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
    const heroState = heroMotion(220, 96, 660, 96);
    equal(limited.heroCopy.style['--sm-hero-y'], `${heroState.y}px`, 'Lightweight hero motion remains enabled when image parallax is restricted');
    equal(limited.heroCopy.style['--sm-hero-opacity'], String(heroState.opacity));
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
equal(state(disabledContract.sections.at(-1).querySelector('h2')), { opacity: .08, y: 48 }, 'Re-enabling motion initializes distant content as well as nearby content');
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

function lineState(heading) {
    return heading.querySelectorAll('.sm-heading-line').map(line => ({ opacity: Number(line.style['--sm-line-opacity'] ?? 1), y: parseFloat(line.style['--sm-line-y']) || 0 }));
}
function expectedLines(engine, heading) {
    const lines = heading.querySelectorAll('.sm-heading-line');
    return lines.map((line, index) => headingLineMotion(engine.window.scrollY, engine.window.innerHeight, heading.bounds.top, heading.bounds.height, 96, index, lines.length));
}
const lineFixture = fixture({ lineHeadings: true });
const originalLines = [...lineFixture.lineHeading.originalLines];
const originalEmphasis = lineFixture.lineHeading.originalEmphasis;
equal(lineFixture.lineHeading.classList.contains('sm-heading-reveal'), true, 'Pre-authored line spans receive the heading-specific enhancement');
equal(lineFixture.lineHeading.classList.contains('sm-reveal'), false, 'Staggered lines do not receive a second whole-heading opacity fade');
equal(lineFixture.lineHeading.classList.contains('sm-shift-reveal'), false, 'The heading layout container does not move with its children');
equal(lineFixture.lineHeading.style['--sm-y'], undefined, 'Only line spans receive heading translations');
equal(lineState(lineFixture.lineHeading), [{ opacity: .08, y: 34 }, { opacity: .08, y: 34 }, { opacity: .08, y: 34 }], 'Every distant line is initialized before the first visit');
equal(lineFixture.twoLineHeading.querySelectorAll('.sm-heading-line').length, 2, 'Two-line editorial headings use the same enhancement');
const lineDOMPositions = [0, 450, 550, 700, 800, 900, 1050, 1200, 1400, 5000];
const lineDOMStates = new Map();
const ruleDOMStates = new Map();
const lineGeometryReads = lineFixture.geometryReads;
for (const y of lineDOMPositions) {
    lineFixture.scroll(y);
    const current = lineState(lineFixture.lineHeading);
    equal(current, expectedLines(lineFixture, lineFixture.lineHeading), 'Rendered line styles follow the shared cached heading geometry');
    lineDOMStates.set(y, current);
    const rule = Number(lineFixture.eyebrow.style['--sm-rule-progress']);
    assert(rule >= 0 && rule <= 1, 'The decorative rule never draws outside its bounded range'); checks++;
    ruleDOMStates.set(y, rule);
}
assert(lineDOMStates.get(550)[0].opacity > lineDOMStates.get(550)[1].opacity && lineDOMStates.get(550)[1].opacity > lineDOMStates.get(550)[2].opacity, 'Actual DOM lines enter in their reading order'); checks++;
equal(lineDOMStates.get(900), [{ opacity: 1, y: 0 }, { opacity: 1, y: 0 }, { opacity: 1, y: 0 }], 'The full heading is readable together in the central reading area');
equal(ruleDOMStates.get(0), 0, 'The brass rule begins undrawn');
equal(ruleDOMStates.get(800), 1, 'The brass rule is fully drawn in its reading region');
equal(ruleDOMStates.get(5000), 0, 'Leaving the section reverses the decorative rule');
for (const y of [...lineDOMPositions].reverse()) {
    lineFixture.scroll(y);
    equal(lineState(lineFixture.lineHeading), lineDOMStates.get(y), 'Actual heading lines return to precisely the same state on the way back');
    equal(Number(lineFixture.eyebrow.style['--sm-rule-progress']), ruleDOMStates.get(y), 'The brass rule reverses from position without a time-based replay');
}
equal(lineFixture.geometryReads, lineGeometryReads, 'Line stagger, inner zoom and brass rules add no per-scroll geometry reads');
equal(lineFixture.lineHeading.children, originalLines, 'Motion preserves the original authored line nodes and their order');
equal(lineFixture.lineHeading.querySelector('em'), originalEmphasis, 'Motion preserves inline emphasis rather than rebuilding heading HTML');
equal(originalEmphasis.textContent, 'It should give you room to feel.');
equal(originalLines.map(line => line.textContent), ['A home should give you', 'more than a place to live.', 'It should give you room to feel.'], 'The authored editorial text remains unchanged');
equal(lineFixture.lineHeading.id, 'line-heading');
equal(lineFixture.lineHeading.getAttribute('aria-describedby'), 'line-caption', 'Heading accessibility relationships survive enhancement');
lineFixture.scroll(5000);
const settledLineWrites = originalLines.map(line => line.styleWrites.length);
const settledRuleWrites = lineFixture.eyebrow.styleWrites.length;
lineFixture.scroll(5100); lineFixture.scroll(5200); lineFixture.trigger('scroll'); lineFixture.flush();
equal(originalLines.map(line => line.styleWrites.length), settledLineWrites, 'Distant heading lines settle once without repeated writes');
equal(lineFixture.eyebrow.styleWrites.length, settledRuleWrites, 'Distant brass rules settle once without repeated writes');
lineFixture.scroll(550);
lineFixture.document.activeElement = lineFixture.sections[2]; lineFixture.documentEvent('focusin'); lineFixture.flush();
equal(lineState(lineFixture.lineHeading), lineDOMStates.get(550), 'Chapter focus on an ancestor does not freeze staggered heading lines');
originalEmphasis.focus(); lineFixture.documentEvent('focusin'); lineFixture.flush();
equal(lineState(lineFixture.lineHeading), [{ opacity: 1, y: 0 }, { opacity: 1, y: 0 }, { opacity: 1, y: 0 }], 'A focused heading descendant restores every line to a readable position');
lineFixture.document.activeElement = lineFixture.document.body; lineFixture.documentEvent('focusout'); lineFixture.flush(); lineFixture.flush();
equal(lineState(lineFixture.lineHeading), lineDOMStates.get(550), 'Blur restores the position-derived heading stagger');
const refreshedLineState = lineState(lineFixture.lineHeading);
lineFixture.trigger('lioravenn:layout-change'); lineFixture.flush();
equal(lineState(lineFixture.lineHeading), refreshedLineState, 'Measuring while lines are translated cannot drift their shared heading bounds');
lineFixture.lineHeading.bounds.top += 100; lineFixture.trigger('lioravenn:layout-change'); lineFixture.flush();
equal(lineState(lineFixture.lineHeading), expectedLines(lineFixture, lineFixture.lineHeading), 'Real layout changes refresh the line group position');
lineFixture.lineHeading.bounds.top -= 100; lineFixture.main.emit('load'); lineFixture.flush();
equal(lineState(lineFixture.lineHeading), refreshedLineState, 'Later asset loads preserve the authored line offsets');
for (const protectedHeading of lineFixture.excludedLineHeadings) {
    equal(protectedHeading.classList.contains('sm-heading-reveal'), false, 'Form, tool, preview, dialog and explicit opt-out headings remain immediately usable');
    equal(protectedHeading.querySelectorAll('.sm-heading-line').every(line => line.styleWrites.length === 0), true, 'Excluded line spans receive no hidden opacity or transform variables');
}
equal(lineFixture.excludedEyebrow.classList.contains('sm-accent'), false, 'Form labels do not acquire decorative scroll rules');
equal(lineFixture.heroEyebrow.classList.contains('sm-accent'), false, 'The hero copy is not given a second nested reveal');
lineFixture.preview.innerHTML = '<h2><span class="sm-heading-line">New preview heading</span></h2>';
lineFixture.trigger('lioravenn:layout-change'); lineFixture.flush();
equal(lineFixture.preview.querySelector('.sm-heading-line').styleWrites.length, 0, 'Rerendered brochure line spans are never registered');

const zoomFixture = fixture({ lineHeadings: true });
const zoomImages = zoomFixture.main.querySelectorAll('.sm-visual-layer').map(layer => layer.querySelector('img'));
equal(zoomImages.length, 2, 'Only the two existing editorial still-image frames receive inner zoom');
equal(zoomImages[1].style['--sm-image-scale'], '1.065', 'A distant image initializes to its bounded zoom baseline');
const distantZoomWrites = zoomImages[1].styleWrites.length;
const zoomStates = new Map();
for (const y of [0, 400, 775, 1200, 1450, 2000]) {
    zoomFixture.scroll(y);
    const scale = Number(zoomFixture.welcomeImage.style['--sm-image-scale']);
    equal(scale, imageScale(y, 900, 1000, 450), 'Actual image zoom follows the unchanged frame geometry');
    zoomStates.set(y, scale);
}
equal(zoomImages[1].styleWrites.length, distantZoomWrites, 'Unvisited distant images do not receive repeated baseline scale writes');
for (const y of [2000, 1450, 1200, 775, 400, 0]) {
    zoomFixture.scroll(y);
    equal(Number(zoomFixture.welcomeImage.style['--sm-image-scale']), zoomStates.get(y), 'The inner image zoom reverses exactly');
}
equal(zoomFixture.cardImage.querySelector('img').style['--sm-image-scale'], undefined, 'Card hover images do not inherit the editorial zoom');
equal(zoomFixture.video.style['--sm-image-scale'], undefined, 'Ambient videos are not scaled by the still-image controller');
zoomFixture.scroll(400);
const originalFrame = zoomFixture.welcomeImage.parentNode.parentNode;
zoomFixture.document.activeElement = originalFrame.parentNode; zoomFixture.documentEvent('focusin'); zoomFixture.flush();
equal(Number(zoomFixture.welcomeImage.style['--sm-image-scale']), zoomStates.get(400), 'Focus on a surrounding section does not freeze an image frame');
zoomFixture.welcomeImage.focus(); zoomFixture.documentEvent('focusin'); zoomFixture.flush();
equal(zoomFixture.welcomeImage.style['--sm-image-scale'], '1', 'Actual frame descendant focus restores the unzoomed image');
zoomFixture.document.activeElement = zoomFixture.document.body; zoomFixture.documentEvent('focusout'); zoomFixture.flush(); zoomFixture.flush();
equal(Number(zoomFixture.welcomeImage.style['--sm-image-scale']), zoomStates.get(400));

for (const options of [{ narrow: true }, { coarse: true }, { cores: 4 }, { memory: 4 }]) {
    const limitedLines = fixture({ ...options, lineHeadings: true });
    limitedLines.scroll(550);
    equal(lineState(limitedLines.lineHeading), expectedLines(limitedLines, limitedLines.lineHeading), 'Lightweight line stagger is retained on limited devices');
    equal(Number(limitedLines.welcomeImage.style['--sm-image-scale']), imageScale(550, 900, 1000, 450), 'Gentle inner zoom is independent of the large-image parallax guard');
    equal(limitedLines.welcomeImage.parentNode.style['--sm-image-y'], '0px', 'Limited devices retain a still image layer while its inner crop changes');
    const heroState = heroMotion(550, 96, 660, 96);
    equal(limitedLines.heroCopy.style['--sm-hero-y'], `${heroState.y}px`, 'Limited-device hero motion remains enabled beside the new effects');
    const limitedReads = limitedLines.geometryReads;
    limitedLines.scroll(650); limitedLines.scroll(550);
    equal(limitedLines.geometryReads, limitedReads, 'Limited-device animation still uses cached geometry');
}
for (const preference of ['off', 'saveData', 'reduced']) {
    const pausedLines = fixture({ lineHeadings: true, motionMode: preference === 'reduced' ? 'auto' : 'on' });
    pausedLines.scroll(550);
    const beforePauseLines = lineState(pausedLines.lineHeading);
    if (preference === 'off') pausedLines.setMotion('off');
    else if (preference === 'saveData') { pausedLines.connection.change(true); pausedLines.flush(); }
    else { pausedLines.reduce.change(true); pausedLines.flush(); }
    equal(lineState(pausedLines.lineHeading), [{ opacity: 1, y: 0 }, { opacity: 1, y: 0 }, { opacity: 1, y: 0 }], 'Disabled motion restores every heading line');
    equal(pausedLines.eyebrow.style['--sm-rule-progress'], '1', 'Disabled motion keeps the decorative rule fully drawn');
    equal(pausedLines.welcomeImage.style['--sm-image-scale'], '1', 'Disabled motion restores the natural image scale');
    const pausedWrites = pausedLines.lineHeading.originalLines.map(line => line.styleWrites.length);
    pausedLines.scroll(650); pausedLines.scroll(550);
    equal(pausedLines.lineHeading.originalLines.map(line => line.styleWrites.length), pausedWrites, 'Disabled line effects do not write again during scrolling');
    if (preference === 'off') pausedLines.setMotion('on');
    else if (preference === 'saveData') { pausedLines.connection.change(false); pausedLines.flush(); }
    else { pausedLines.reduce.change(false); pausedLines.flush(); }
    equal(lineState(pausedLines.lineHeading), beforePauseLines, 'Restoring motion recomputes the current stagger without an entry event');
}
const transformedLines = fixture({ lineHeadings: true, transformedCopy: true }); transformedLines.scroll(550);
equal(transformedLines.lineHeading.classList.contains('sm-heading-reveal'), false, 'Existing custom heading transforms retain their fade-only fallback');
equal(transformedLines.lineHeading.originalLines.every(line => line.styleWrites.length === 0), true, 'Existing transforms do not gain competing nested translations');
equal(state(transformedLines.lineHeading).opacity, expected(transformedLines, transformedLines.lineHeading).opacity);
const nonHomeLines = fixture({ home: false, lineHeadings: true }); nonHomeLines.scroll(200);
equal(lineState(nonHomeLines.lineHeading), expectedLines(nonHomeLines, nonHomeLines.lineHeading), 'Static editorial line headings are enhanced on inner pages');
equal(nonHomeLines.main.querySelectorAll('.sm-visual-frame').length, 0, 'Inner pages do not gain homepage image wrappers');
const noLineEnhancement = fixture({ raf: false, lineHeadings: true });
equal(noLineEnhancement.lineHeading.originalLines.every(line => line.styleWrites.length === 0), true, 'Without enhancement authored line spans remain visible');

assert(css.includes('opacity: var(--sm-opacity,1)')); checks++;
const textRule = css.match(/\.sm-enhanced\s+\.sm-reveal\s*\{([^}]+)\}/)?.[1] || '';
const imageRule = css.match(/\.sm-enhanced\s+\.sm-image-reveal\s*\{([^}]+)\}/)?.[1] || '';
equal(textRule.match(/transition:\s*([^;]+);/)?.[1].trim(), 'opacity .2s ease-out', 'Text opacity is gently eased while position remains tied directly to scrolling');
const imageProperties = imageRule.match(/transition-property:\s*([^;]+);/)?.[1].split(',').map(value => value.trim()) || [];
const imageDurations = imageRule.match(/transition-duration:\s*([^;]+);/)?.[1].split(',').map(value => parseFloat(value)) || [];
equal(imageDurations[imageProperties.indexOf('opacity')], .24, 'Image opacity uses the approved short easing duration');
equal(imageDurations[imageProperties.indexOf('transform')], .7, 'Existing image hover transform easing remains available');
const lineRule = css.match(/\.sm-enhanced\s+\.sm-heading-reveal>\.sm-heading-line\s*\{([^}]+)\}/)?.[1] || '';
equal(lineRule.match(/transition:\s*([^;]+);/)?.[1].trim(), 'opacity .22s ease-out', 'Line opacity uses short easing without delayed transform animations');
assert(lineRule.includes('opacity: var(--sm-line-opacity,1)') && lineRule.includes('translateY(var(--sm-line-y,0px))'), 'Line motion is applied to the authored spans'); checks++;
const brassRule = css.match(/\.sm-accent::before\s*\{([^}]+)\}/)?.[1] || '';
assert(brassRule.includes('position: absolute') && brassRule.includes("content: ''"), 'The brass rule is decorative and cannot change heading layout'); checks++;
assert(brassRule.includes('scaleX(var(--sm-rule-progress,1))') && brassRule.includes('transform-origin: left center'), 'The brass rule draws from its starting edge using bounded scroll progress'); checks++;
const innerImageRule = css.match(/\.sm-visual-layer>img\s*\{([^}]+)\}/)?.[1] || '';
assert(innerImageRule.includes('scale(var(--sm-image-scale,1))') && innerImageRule.includes('object-fit: cover'), 'The still image zoom is composed on the inner image rather than its parallax parent'); checks++;
assert(/\.sm-reduced\s+\.sm-heading-line/.test(css) && /html\[data-motion-preference="off"\]\s+\.sm-heading-line/.test(css), 'Live Off and reduced-motion styles restore authored heading lines'); checks++;
assert(/@media print\s*\{[^}]*\.sm-heading-line[^}]*transform:\s*none!important/.test(css), 'Printed headings and images are untransformed and fully visible'); checks++;
assert(!/\.sm-static-effects\s+\.sm-hero-copy\s*\{/.test(css), 'Image-parallax capability guards must not hide lightweight hero movement'); checks++;
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

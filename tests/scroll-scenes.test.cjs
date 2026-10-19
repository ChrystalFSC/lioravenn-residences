// Run: node --test tests/scroll-scenes.test.cjs
// Exercise the real scene controller. Native sticky layout, clipping and visual
// composition still require browser QA at desktop, tablet and phone sizes.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'js/scroll-scenes.js');
const source = fs.readFileSync(filename, 'utf8');
const css = fs.readFileSync(path.join(root, 'css/scroll-scenes.css'), 'utf8');
const { entranceProgress, showcaseProgress, deckPose, videoPose } = require(filename);

test('scene phases clamp at boundaries and reproduce the same phase in reverse', () => {
    assert.equal(entranceProgress(0, 1000, 900, 0), 0);
    assert.equal(entranceProgress(360, 1000, 900, 0), .5);
    assert.equal(entranceProgress(720, 1000, 900, 0), 1);
    assert.equal(entranceProgress(-1000, 1000, 900, 80), 0);
    assert.equal(entranceProgress(10000, 1000, 900, 80), 1);
    assert.equal(showcaseProgress(900, 1000, 100, 800), 0);
    assert.equal(showcaseProgress(1300, 1000, 100, 800), .5);
    assert.equal(showcaseProgress(1700, 1000, 100, 800), 1);
    assert.equal(entranceProgress(NaN, 900, 1000, 80), 1);
    assert.equal(entranceProgress(0, 0, 1000, 80), 1);
    assert.equal(showcaseProgress(1000, 1000, 80, 0), 0);
    assert.equal(showcaseProgress(NaN, 1000, 80, 800), 0);
    const positions = [0, 300, 900, 1100, 1300, 1700, 5000];
    const phases = positions.map(y => [entranceProgress(y, 900, 1000, 80), showcaseProgress(y, 1000, 80, 800)]);
    positions.toReversed().forEach((y, index) => assert.deepEqual([entranceProgress(y, 900, 1000, 80), showcaseProgress(y, 1000, 80, 800)], phases.at(-1 - index)));
});

test('the residence deck visibly moves through each home without opacity tricks', () => {
    assert.deepEqual(deckPose(0, 0, 3), { x: 0, y: 0, rotate: 0, scale: 1 });
    assert.deepEqual(deckPose(0, 1, 3), { x: 1.5, y: 14, rotate: 1.5, scale: .965 });
    assert.deepEqual(deckPose(0, 2, 3), { x: 3, y: 28, rotate: 3, scale: .93 });
    assert.deepEqual(deckPose(.5, 0, 3), { x: -112, y: -28, rotate: -8, scale: 1 });
    assert.deepEqual(deckPose(.5, 1, 3), { x: 0, y: 0, rotate: 0, scale: 1 });
    assert.deepEqual(deckPose(1, 2, 3), { x: 0, y: 0, rotate: 0, scale: 1 });
    for (const progress of [0, .125, .25, .5, .75, .875, 1]) {
        for (let index = 0; index < 3; index++) {
            const pose = deckPose(progress, index, 3);
            assert(pose.x >= -112 && pose.x <= 3);
            assert(pose.y >= -28 && pose.y <= 28);
            assert(pose.rotate >= -8 && pose.rotate <= 3);
            assert(pose.scale >= .93 && pose.scale <= 1);
            assert.equal(Object.hasOwn(pose, 'opacity'), false);
        }
    }
});

test('the lifestyle surface grows from an inset rounded pose to a straight full-size pose', () => {
    assert.deepEqual(videoPose(0), { scale: .76, radius: 110, tilt: 8 });
    assert.deepEqual(videoPose(.5), { scale: .88, radius: 55, tilt: 4 });
    assert.deepEqual(videoPose(1), { scale: 1, radius: 0, tilt: 0 });
    assert.deepEqual(videoPose(-1), videoPose(0));
    assert.deepEqual(videoPose(2), videoPose(1));
    const positions = [0, .1, .4, .8, 1];
    const poses = positions.map(videoPose);
    positions.toReversed().forEach((progress, index) => assert.deepEqual(videoPose(progress), poses.at(-1 - index)));
});

class Target {
    constructor() { this.listeners = new Map(); }
    addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(listener); }
    removeEventListener(type, listener) { this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item !== listener)); }
    emit(type, values = {}) { for (const listener of [...(this.listeners.get(type) || [])]) listener({ type, ...values }); }
}

class Element extends Target {
    constructor(tag, engine, attrs = {}, bounds = {}) {
        super();
        this.tagName = tag.toUpperCase(); this.engine = engine; this.attrs = { ...attrs };
        this.children = []; this.parentNode = null; this.styleWrites = [];
        this.bounds = { top: 0, width: 1000, height: 60, ...bounds };
        this.className = attrs.class || '';
        this.classList = {
            add: (...names) => names.forEach(name => this.classes.add(name)),
            remove: (...names) => names.forEach(name => this.classes.delete(name)),
            contains: name => this.classes.has(name),
            toggle: (name, force) => { const enabled = force === undefined ? !this.classes.has(name) : force; if (enabled) this.classes.add(name); else this.classes.delete(name); return enabled; }
        };
        const node = this;
        this.style = new Proxy({
            setProperty(name, value) { this[name] = String(value); },
            removeProperty(name) { const previous = this[name]; delete this[name]; return previous; },
            getPropertyValue(name) { return this[name] || ''; }
        }, {
            set(target, name, value) { node.styleWrites.push([name, String(value)]); target[name] = String(value); return true; },
            deleteProperty(target, name) { node.styleWrites.push([name, null]); delete target[name]; return true; }
        });
    }
    set className(value) { this.classes = new Set(String(value).split(/\s+/).filter(Boolean)); }
    get className() { return [...this.classes].join(' '); }
    get dataset() { return Object.fromEntries(Object.entries(this.attrs).filter(([key]) => key.startsWith('data-')).map(([key, value]) => [key.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase()), value])); }
    get id() { return this.attrs.id || ''; }
    set id(value) { this.attrs.id = String(value); }
    append(...nodes) { for (const node of nodes) { if (node.parentNode) node.parentNode.children = node.parentNode.children.filter(child => child !== node); node.parentNode = this; this.children.push(node); } }
    all() { return this.children.flatMap(child => [child, ...child.all()]); }
    contains(node) { return this === node || this.all().includes(node); }
    simpleMatch(selector) {
        let valid = true;
        const stripped = selector.replace(/\[([^=\]]+)(?:=["']?([^\]"']*)["']?)?\]/g, (_, key, value) => { valid &&= Object.hasOwn(this.attrs, key) && (value === undefined || this.attrs[key] === value); return ''; });
        const tag = stripped.match(/^[a-z][\w-]*/i)?.[0];
        if (tag && this.tagName !== tag.toUpperCase()) return false;
        for (const [, name] of stripped.matchAll(/\.([\w-]+)/g)) if (!this.classes.has(name)) return false;
        for (const [, id] of stripped.matchAll(/#([\w-]+)/g)) if (this.id !== id) return false;
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
    setAttribute(name, value) { if (name === 'class') this.className = value; else this.attrs[name] = String(value); }
    getAttribute(name) { return this.attrs[name] ?? null; }
    hasAttribute(name) { return Object.hasOwn(this.attrs, name); }
    removeAttribute(name) { delete this.attrs[name]; }
    getBoundingClientRect() {
        this.engine.geometryReads++;
        this.engine.geometryTargets.push(this);
        const naturalTop = this.bounds.top - this.engine.window.scrollY;
        const top = this.sticky ? Math.max(this.engine.stickyTop, naturalTop) : naturalTop;
        return { ...this.bounds, top, bottom: top + this.bounds.height, left: 0, right: this.bounds.width };
    }
    get offsetHeight() { this.engine.geometryReads++; return this.bounds.height; }
    get offsetWidth() { this.engine.geometryReads++; return this.bounds.width; }
    get clientWidth() { this.engine.geometryReads++; return this.bounds.width; }
    get clientHeight() { this.engine.geometryReads++; return this.bounds.height; }
    get scrollWidth() { this.engine.geometryReads++; return this.contentWidth || this.bounds.width; }
    focus() { this.engine.document.activeElement = this; this.engine.document.emit('focusin', { target: this }); }
}

function fixture({ width = 1440, height = 900, headerHeight = 96, home = true, motion = true, saveData = false, reduced = false, sharedMotion = true, raf = true, resizeObserver = true, cards = 3, missing = false, coarse = false, cores = 8, memory = 8, incompleteShowcase = false } = {}) {
    const engine = { frames: new Map(), nextFrame: 1, geometryReads: 0, geometryTargets: [], resizeObservers: [], created: [], stickyTop: headerHeight + 20 };
    const window = engine.window = new Target();
    const document = engine.document = new Target();
    const connection = engine.connection = new Target(); connection.saveData = saveData;
    const media = engine.media = new Target(); media.matches = reduced; media.addListener = listener => media.addEventListener('change', listener);
    const html = document.documentElement = new Element('html', engine);
    const body = document.body = new Element('body', engine, { class: home ? 'home-page' : 'other-page' }); html.append(body);
    document.activeElement = body;
    Object.assign(window, {
        innerWidth: width, innerHeight: height, scrollY: 0,
        navigator: { connection, hardwareConcurrency: cores, deviceMemory: memory, maxTouchPoints: coarse ? 1 : 0 },
        matchMedia: query => query.includes('reduced-motion') ? media : { matches: query.includes('coarse') ? coarse : false, addEventListener() {}, addListener() {} },
        requestAnimationFrame: raf ? callback => { const id = engine.nextFrame++; engine.frames.set(id, callback); return id; } : undefined,
        cancelAnimationFrame: id => engine.frames.delete(id),
        getComputedStyle: element => ({ transform: 'none', position: element.sticky ? 'sticky' : 'static' })
    });
    if (sharedMotion) window.LioravennMotion = { isEnabled: () => motion, getMode: () => motion ? 'on' : 'off' };
    document.createElement = tag => { const node = new Element(tag, engine); engine.created.push(node); return node; };
    document.querySelector = selector => html.querySelector(selector);
    document.querySelectorAll = selector => html.querySelectorAll(selector);
    document.getElementById = id => html.all().find(node => node.id === id) || null;
    document.fonts = { ready: { then(callback) { engine.fontsReady = callback; } } };
    const create = (tag, parent, attrs, bounds) => { const element = new Element(tag, engine, attrs, bounds); parent.append(element); return element; };
    engine.header = create('header', body, { class: 'site-header' }, { height: headerHeight });
    engine.main = create('main', body, { id: 'main-content' }, { height: 7000 });
    if (!missing) {
        engine.shutters = create('section', engine.main, { 'data-scroll-scene': 'shutters', class: 'welcome-section' }, { top: 1000, height: 900 });
        engine.welcomeFrame = create('div', engine.shutters, { class: 'sm-visual-frame' }, { top: 1050, height: 450 });
        engine.welcomeImage = create('img', engine.welcomeFrame, { src: 'interior.webp', alt: 'A considered interior' }, { top: 1050, height: 450 });
        engine.caption = create('span', engine.shutters, { class: 'image-caption' });
        engine.welcomeLink = create('a', engine.shutters, { href: 'concept.html' });
        engine.showcase = create('section', engine.main, { 'data-scroll-scene': 'showcase', class: 'collection-section' }, { top: 2000, height: 2000 });
        engine.track = create('div', engine.showcase, { class: 'scene-showcase-track' }, { top: 2200, height: 1800 });
        engine.stage = create('div', engine.track, { class: incompleteShowcase ? 'incomplete-stage' : 'scene-showcase-stage' }, { top: 2200, height: 660 }); engine.stage.sticky = true;
        engine.cardWindow = create('div', engine.stage, { class: 'scene-showcase-window' }, { top: 2200, height: 600, width: Math.min(width - 40, 1200) });
        engine.units = create('div', engine.cardWindow, { id: 'home-units', class: 'home-units' }, { top: 2200, height: 580 });
        engine.cards = Array.from({ length: cards }, (_, index) => {
            const card = create('a', engine.units, { class: 'home-unit', href: `floor-plans.html?unit=type-${index}`, 'data-unit': `type-${index}` }, { top: 2200, width: Math.min(width - 60, 900), height: 580 });
            create('span', card, { class: 'home-unit-image' });
            create('h3', card, {}).textContent = `Home ${index + 1}`;
            return card;
        });
        const meta = create('div', engine.stage, { class: 'scene-showcase-meta', 'aria-hidden': 'true' });
        engine.counter = create('span', meta, { class: 'scene-showcase-count' });
        engine.videoScene = create('section', engine.main, { 'data-scroll-scene': 'video', class: 'residence-motion' }, { top: 4500, height: 1200 });
        engine.videoAnchor = create('div', engine.videoScene, { class: 'scene-video-anchor' }, { top: 4700, height: 700 });
        engine.videoSurface = create('div', engine.videoAnchor, { class: 'residence-video', 'data-video-surface': '' }, { top: 4700, height: 700 });
        engine.poster = create('img', engine.videoSurface, { class: 'video-poster', src: 'poster.webp', alt: 'Landscaped leisure spaces' });
        engine.video = create('video', engine.videoSurface, { 'data-ambient-video': '', tabindex: '-1', 'aria-hidden': 'true' });
        Object.assign(engine.video, { autoplay: true, muted: true, loop: true, playsInline: true, controls: false });
        engine.video.play = engine.video.load = () => { throw new Error('A scroll scene must not control ambient playback'); };
    }
    if (resizeObserver) window.ResizeObserver = class {
        constructor(callback) { this.callback = callback; this.targets = []; engine.resizeObservers.push(this); }
        observe(target) { this.targets.push(target); }
        emit() { this.callback(this.targets.map(target => ({ target, contentRect: { width: target.bounds.width, height: target.bounds.height } }))); }
    };
    engine.flush = () => { const callbacks = [...engine.frames.values()]; engine.frames.clear(); callbacks.forEach(callback => callback()); };
    engine.scroll = y => { window.scrollY = y; window.emit('scroll'); engine.flush(); };
    engine.setMotion = value => { motion = value; window.emit('lioravenn:motion-change'); engine.flush(); };
    engine.setSaveData = value => { connection.saveData = value; connection.emit('change'); engine.flush(); };
    engine.setReduced = value => { media.matches = value; media.emit('change'); engine.flush(); };
    engine.blur = () => { document.activeElement = body; document.emit('focusout', { target: body }); engine.flush(); engine.flush(); };
    vm.runInNewContext(source, { window, document }, { filename });
    engine.flush();
    engine.resizeObservers.forEach(observer => observer.emit()); engine.flush();
    return engine;
}

const number = (element, key) => parseFloat(element.style[key]);
const cardPose = card => ({ x: number(card, '--scene-card-x'), y: number(card, '--scene-card-y'), rotate: number(card, '--scene-card-rotate'), scale: number(card, '--scene-card-scale') });
const videoState = engine => ({ scale: number(engine.videoSurface, '--scene-video-scale'), radius: number(engine.videoSurface, '--scene-video-radius'), tilt: number(engine.videoSurface, '--scene-video-tilt') });
const sceneState = engine => ({ shutters: [number(engine.welcomeFrame, '--scene-shutter-left'), number(engine.welcomeFrame, '--scene-shutter-right')], deck: engine.cards.map(cardPose), video: videoState(engine), count: engine.counter.textContent });
const writeCount = engine => engine.document.documentElement.all().reduce((count, element) => count + element.styleWrites.length, 0);

test('all three scenes begin in structural poses while preserving original content and links', () => {
    const f = fixture();
    assert(f.document.documentElement.classList.contains('scene-motion-enabled'));
    assert(f.showcase.classList.contains('scene-showcase-active'));
    assert(f.welcomeFrame.classList.contains('scene-aperture'));
    assert.deepEqual(sceneState(f).shutters, [0, 0]);
    assert.deepEqual(f.cards.map(cardPose), [deckPose(0, 0), deckPose(0, 1), deckPose(0, 2)]);
    assert.deepEqual(f.cards.map(card => card.style['--scene-card-order']), ['3', '2', '1']);
    assert.equal(f.counter.textContent, '01 / 03');
    assert.equal(f.counter.parentNode.getAttribute('aria-hidden'), 'true');
    assert.equal(f.showcase.style['--scene-sticky-top'], '116px');
    assert.equal(f.showcase.style['--scene-stage-height'], '640px');
    assert.equal(f.showcase.style['--scene-runway'], '1620px');
    assert.deepEqual(videoState(f), { scale: .76, radius: 110, tilt: 8 });
    assert.equal(f.welcomeImage.parentNode, f.welcomeFrame);
    assert.equal(f.caption.parentNode, f.shutters);
    assert.equal(f.welcomeLink.getAttribute('href'), 'concept.html');
    assert.deepEqual(f.cards.map(card => card.getAttribute('href')), ['floor-plans.html?unit=type-0', 'floor-plans.html?unit=type-1', 'floor-plans.html?unit=type-2']);
    assert.equal(f.created.length, 0, 'No toggles, replacement links or extra UI are created');
});

test('shutters, residence deck and video visibly advance and reverse from cached position', () => {
    const f = fixture();
    const reads = f.geometryReads;
    const start = f.track.bounds.top - 116;
    const middle = start + 810;
    const end = start + 1620;
    f.scroll(516);
    assert.deepEqual(sceneState(f).shutters, [-50, 50]);
    f.scroll(792);
    assert.deepEqual(sceneState(f).shutters, [-100, 100]);
    f.scroll(middle);
    assert.deepEqual(f.cards.map(cardPose), [deckPose(.5, 0), deckPose(.5, 1), deckPose(.5, 2)]);
    assert.equal(f.counter.textContent, '02 / 03');
    f.scroll(end);
    assert.deepEqual(cardPose(f.cards[2]), { x: 0, y: 0, rotate: 0, scale: 1 });
    assert.equal(f.counter.textContent, '03 / 03');
    f.scroll(4166);
    assert.deepEqual(videoState(f), { scale: .88, radius: 55, tilt: 4 });
    f.scroll(4442);
    assert.deepEqual(videoState(f), { scale: 1, radius: 0, tilt: 0 });
    const positions = [0, 516, 792, start, middle, end, 4166, 4442, 6500];
    const states = positions.map(y => { f.scroll(y); return sceneState(f); });
    positions.toReversed().forEach((y, index) => { f.scroll(y); assert.deepEqual(sceneState(f), states.at(-1 - index)); });
    assert.equal(f.geometryReads, reads, 'No scene geometry is read during ordinary scroll or page-sized jumps');
});

test('scroll frames coalesce and settled scene states do not keep writing or animating', () => {
    const f = fixture();
    const reads = f.geometryReads;
    const writes = writeCount(f);
    f.window.emit('scroll'); f.window.emit('scroll'); f.window.emit('scroll');
    assert.equal(f.frames.size, 1);
    f.flush();
    assert.equal(f.frames.size, 0, 'There is no idle animation loop');
    assert.equal(writeCount(f), writes, 'An unchanged visible pose has no duplicate writes');
    assert.equal(f.geometryReads, reads);
    f.scroll(6500);
    const settled = writeCount(f);
    f.scroll(6600); f.scroll(6700); f.window.emit('scroll'); f.flush();
    assert.equal(writeCount(f), settled, 'Fully traversed distant scenes keep their final pose without repeated writes');
    assert.equal(f.geometryReads, reads);
    f.scroll(0);
    const entryWrites = writeCount(f);
    f.scroll(-100); f.scroll(-200);
    assert.equal(writeCount(f), entryWrites, 'Unvisited scenes retain a stable start pose');
});

test('layout refreshes use untransformed flow anchors while the stage is stuck', () => {
    const f = fixture();
    f.scroll(2894);
    const before = sceneState(f);
    assert.equal(f.stage.getBoundingClientRect().top, 116, 'The fixture stage is genuinely represented as stuck');
    assert.notEqual(f.stage.bounds.top - f.window.scrollY, 116);
    f.videoSurface.bounds.top += 900;
    f.cards.forEach(card => card.bounds.top += 500);
    const firstRead = f.geometryTargets.length;
    f.window.emit('lioravenn:layout-change'); f.flush();
    assert.deepEqual(sceneState(f), before, 'Translated children and stuck stage positions cannot change the scene phase');
    assert.deepEqual(f.geometryTargets.slice(firstRead).map(element => element === f.header ? 'header' : element === f.welcomeFrame ? 'aperture' : element === f.track ? 'track' : element === f.videoAnchor ? 'video-anchor' : 'unexpected'), ['header', 'aperture', 'track', 'video-anchor']);
    f.track.bounds.top += 200;
    f.window.emit('lioravenn:layout-change'); f.flush();
    assert.deepEqual(cardPose(f.cards[1]), deckPose(showcaseProgress(2894, 2400, 116, 1620), 1));
    assert.notDeepEqual(sceneState(f).deck, before.deck, 'Real flow layout changes refresh the cached anchor');
    f.track.bounds.top -= 200; f.main.emit('load'); f.flush();
    assert.deepEqual(sceneState(f), before, 'A later image load restores the correct native phase');
    for (const refresh of [() => f.window.emit('pageshow'), () => f.fontsReady(), () => f.document.emit('visibilitychange')]) {
        const count = f.geometryReads; refresh(); f.flush();
        assert(f.geometryReads > count);
        assert.deepEqual(sceneState(f), before);
    }
    const hiddenReads = f.geometryReads;
    f.document.hidden = true; f.document.emit('visibilitychange'); f.flush();
    assert.equal(f.geometryReads, hiddenReads, 'Hiding the tab does not force a layout walk');
});

test('desktop, 778px tablet and phones retain obvious structural motion without hardware gating', () => {
    for (const width of [1440, 1024, 801, 800, 778, 550, 390, 320]) {
        const f = fixture({ width, height: 844, headerHeight: width <= 800 ? 80 : 96, coarse: width <= 800, cores: 4, memory: 4 });
        assert(f.document.documentElement.classList.contains('scene-motion-enabled'), `${width}px structural scenes stay enabled`);
        assert(f.showcase.classList.contains('scene-showcase-active'), `${width}px residence deck remains enabled in a sufficiently tall viewport`);
        f.scroll(3000);
        assert(number(f.cards[0], '--scene-card-x') < -100, `${width}px produces visible horizontal card travel`);
        assert.deepEqual(sceneState(f).shutters, [-100, 100]);
        assert.equal(number(f.videoSurface, '--scene-video-scale'), .76);
        const reads = f.geometryReads; f.scroll(3010); f.scroll(3000);
        assert.equal(f.geometryReads, reads);
    }
});

test('short viewports and incomplete decks keep ordinary card flow and can recover on resize', () => {
    for (const options of [{ height: 639 }, { width: 320, height: 568 }, { cards: 0 }, { cards: 1 }, { incompleteShowcase: true }]) {
        const f = fixture(options);
        assert(f.document.documentElement.classList.contains('scene-motion-enabled'));
        assert.equal(f.showcase.classList.contains('scene-showcase-active'), false);
        assert(f.cards.every(card => card.style['--scene-card-x'] === undefined), 'Static-flow cards never receive an offscreen pose');
        f.scroll(3500);
        assert(f.cards.every(card => card.style['--scene-card-x'] === undefined));
        assert.deepEqual(sceneState(f).shutters, [-100, 100], 'Other structural scenes still work when the deck is in normal flow');
    }
    const f = fixture({ width: 390, height: 639, headerHeight: 80 });
    f.window.innerHeight = 640; f.window.emit('resize'); f.flush();
    assert(f.showcase.classList.contains('scene-showcase-active'), '640px is the inclusive deck threshold');
    assert.equal(f.showcase.style['--scene-stage-height'], '464px', 'Phone decks reserve room for the fixed viewing CTA');
    assert.equal(f.showcase.style['--scene-runway'], '1152px');
    f.window.innerHeight = 568; f.window.emit('resize'); f.flush();
    assert.equal(f.showcase.classList.contains('scene-showcase-active'), false, 'A short viewport releases the sticky runway');
    f.window.innerWidth = 778; f.window.innerHeight = 900; f.window.emit('resize'); f.flush();
    assert(f.showcase.classList.contains('scene-showcase-active'));
    assert.equal(f.showcase.style['--scene-stage-height'], '640px');
    assert.equal(f.showcase.style['--scene-runway'], '1620px');
    for (const [width, expectedHeight] of [[600, '524px'], [601, '580px']]) {
        const bounded = fixture({ width, height: 700, headerHeight: 80 });
        assert.equal(bounded.showcase.style['--scene-stage-height'], expectedHeight, 'Phone CTA clearance changes at the intended width boundary');
    }
});

test('keyboard focus makes every home visible and blur restores the native scroll phase', () => {
    const f = fixture();
    f.scroll(2084);
    const nativePose = f.cards.map(cardPose);
    const reads = f.geometryReads;
    for (let index = 0; index < f.cards.length; index++) {
        f.cardWindow.scrollLeft = 47;
        f.cardWindow.scrollTop = 31;
        f.cards[index].querySelector('h3').focus(); f.flush();
        assert.deepEqual(cardPose(f.cards[index]), { x: 0, y: 0, rotate: 0, scale: 1 }, 'The focused home is centered at full size');
        assert.equal(f.cardWindow.scrollLeft, 0, 'Native focus cannot leave the clipped viewport horizontally scrolled');
        assert.equal(f.cardWindow.scrollTop, 0, 'Native focus cannot leave the clipped viewport vertically scrolled');
        assert.equal(f.counter.textContent, `${String(index + 1).padStart(2, '0')} / 03`);
        assert.equal(f.window.scrollY, 2084, 'The scene does not hijack document scrolling');
        f.blur();
        assert.deepEqual(f.cards.map(cardPose), nativePose, 'Blur returns to the unchanged document scroll phase');
    }
    f.showcase.focus(); f.flush();
    assert.deepEqual(f.cards.map(cardPose), nativePose, 'Ancestor section focus does not force a card phase');
    assert.equal(f.geometryReads, reads, 'Keyboard focus does not require a geometry read');
});

test('live Off and Save Data remove active layout gates and stop scroll scheduling', () => {
    for (const preference of ['motion', 'saveData']) {
        const f = fixture(); f.scroll(2894);
        const active = sceneState(f);
        if (preference === 'motion') f.setMotion(false); else f.setSaveData(true);
        assert.equal(f.document.documentElement.classList.contains('scene-motion-enabled'), false);
        assert.equal(f.showcase.classList.contains('scene-showcase-active'), false, 'The static fallback removes the sticky height/absolute-card gate');
        const writes = writeCount(f); const reads = f.geometryReads;
        f.window.emit('scroll');
        assert.equal(f.frames.size, 0, 'Disabled effects do not even schedule scroll frames');
        f.scroll(2900); f.scroll(2894);
        assert.equal(writeCount(f), writes); assert.equal(f.geometryReads, reads);
        if (preference === 'motion') f.setMotion(true); else f.setSaveData(false);
        assert(f.showcase.classList.contains('scene-showcase-active'));
        assert.deepEqual(sceneState(f), active, 'Re-enabling recomputes the current phase without an entry event');
    }
});

test('shared On respects the current contract while Save Data and fallback reduced motion remain effective', () => {
    assert(fixture({ reduced: true }).document.documentElement.classList.contains('scene-motion-enabled'));
    const saving = fixture({ reduced: true, saveData: true });
    assert.equal(saving.document.documentElement.classList.contains('scene-motion-enabled'), false);
    saving.setSaveData(false);
    assert(saving.document.documentElement.classList.contains('scene-motion-enabled'));
    const fallback = fixture({ sharedMotion: false, reduced: true });
    assert.equal(fallback.document.documentElement.classList.contains('scene-motion-enabled'), false);
    fallback.setReduced(false);
    assert(fallback.document.documentElement.classList.contains('scene-motion-enabled'));
    fallback.setReduced(true);
    assert.equal(fallback.showcase.classList.contains('scene-showcase-active'), false);
});

test('native ambient video and poster behavior are untouched through scene lifecycles', () => {
    const f = fixture();
    const parent = f.video.parentNode; const poster = f.poster;
    f.scroll(4166); f.setMotion(false); f.setMotion(true); f.setSaveData(true); f.setSaveData(false);
    assert.equal(f.video.parentNode, parent);
    assert.equal(f.poster, poster);
    assert.equal(f.poster.getAttribute('src'), 'poster.webp');
    assert.deepEqual([f.video.autoplay, f.video.muted, f.video.loop, f.video.playsInline, f.video.controls], [true, true, true, true, false]);
    assert.equal(f.video.styleWrites.length, 0, 'Only the original surrounding surface is transformed');
    assert.equal(f.poster.styleWrites.length, 0);
});

test('unsupported enhancement, pages without hooks and missing scene content stay static', () => {
    for (const options of [{ raf: false }, { missing: true }, { home: false, missing: true }]) {
        const f = fixture(options);
        assert.equal(f.document.documentElement.classList.contains('scene-motion-enabled'), false);
        assert.equal(f.created.length, 0);
        assert.equal(f.window.listeners.size, 0, 'An inapplicable controller does not register lifecycle work');
        assert.equal(f.frames.size, 0);
        assert.equal(f.showcase?.classList.contains('scene-showcase-active') || false, false);
    }
});

test('CSS gates sticky/clipped geometry to the active scene and restores printable normal flow', () => {
    assert.match(css, /\.scene-showcase-active\s+\.scene-showcase-track\s*\{[^}]*height:\s*calc\(var\(--scene-stage-height\)\s*\+\s*var\(--scene-runway\)\)/);
    assert.match(css, /\.scene-showcase-active\s+\.scene-showcase-stage\s*\{[^}]*position:\s*sticky/);
    assert.match(css, /\.scene-showcase-active\s+\.scene-showcase-window\s*\{[^}]*overflow:\s*hidden/);
    assert.match(css, /\.scene-showcase-active\s+\.home-unit\s*\{[^}]*position:\s*absolute[^}]*translate3d\(var\(--scene-card-x/);
    assert.match(css, /\.scene-motion-enabled\s+\.scene-aperture::after\s*\{[^}]*pointer-events:\s*none/);
    assert.match(css, /\.scene-motion-enabled\s+\[data-scroll-scene="video"\]\s+\.residence-video\s*\{[^}]*scale\(var\(--scene-video-scale/);
    assert.match(css, /@media\(max-width:800px\)/);
    assert.match(css, /@media\(max-width:600px\)/);
    const printRules = css.slice(css.indexOf('@media print'));
    assert.match(printRules, /\.scene-showcase-active\s+\.scene-showcase-track\s*\{\s*height:\s*auto/);
    assert.match(printRules, /\.scene-showcase-active\s+\.scene-showcase-stage\s*\{\s*position:\s*static/);
    assert.match(printRules, /\.scene-showcase-active\s+\.home-unit\s*\{\s*position:\s*static;\s*transform:\s*none/);
    assert.match(printRules, /\.scene-aperture::after\s*\{\s*display:\s*none/);
    assert.equal(source.includes('preventDefault'), false, 'Scenes use native scrolling and native links');
    assert.equal(source.includes('IntersectionObserver'), false, 'Scene state does not depend on one-shot entry events');
    const oldSource = fs.readFileSync(path.join(root, 'js/scroll-motion.js'), 'utf8');
    assert(oldSource.includes('[data-scroll-scene]'), 'The editorial renderer excludes scene-owned elements');
});

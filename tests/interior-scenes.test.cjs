// Run: node --test tests/interior-scenes.test.cjs
// Real controller plus authored page contracts. Browser QA remains responsible
// for composition, native filtering/lightboxes and actual CSS rendering.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'js/scroll-scenes.js');
const source = fs.readFileSync(filename, 'utf8');
const css = fs.readFileSync(path.join(root, 'css/scroll-scenes.css'), 'utf8');
const interiorCSS = fs.readFileSync(path.join(root, 'css/interior-scenes.css'), 'utf8');
const { entranceProgress, departureProgress, titlePose, artPose, fanPose, balancePose } = require(filename);
const pages = ['concept', 'floor-plans', 'gallery', 'calculator', 'contact', 'brochure'];

test('departure and title motion are clamped, obvious and independent of scroll direction', () => {
    assert.equal(departureProgress(920, 1000, 1000, 80), 0);
    assert.equal(departureProgress(1245, 1000, 1000, 80), .5);
    assert.equal(departureProgress(1570, 1000, 1000, 80), 1);
    assert.deepEqual(titlePose(0, 0, 1440), { x: 0, turn: 0 });
    assert.deepEqual(titlePose(.5, 0, 1440), { x: -90, turn: 1 });
    assert.deepEqual(titlePose(.5, 1, 1440), { x: 90, turn: -1 });
    assert.deepEqual(titlePose(1, 0, 320), { x: -64, turn: 2 });
    const positions = [0, .1, .4, .75, 1];
    const states = positions.map(progress => [titlePose(progress, 0, 778), titlePose(progress, 1, 778)]);
    positions.toReversed().forEach((progress, index) => assert.deepEqual([titlePose(progress, 0, 778), titlePose(progress, 1, 778)], states.at(-1 - index)));
});

test('hinged and gallery artwork move geometrically and settle without opacity', () => {
    assert.deepEqual(artPose(0, 0, 'hinge'), { x: -14, y: 0, turn: -24, scale: .92 });
    assert.deepEqual(artPose(0, 1, 'hinge'), { x: 14, y: 0, turn: 24, scale: .92 });
    assert.deepEqual(artPose(.5, 0, 'hinge'), { x: -7, y: 0, turn: -12, scale: .96 });
    assert.deepEqual(artPose(0, 0, 'gallery'), { x: -8, y: 42, turn: -6, scale: 1.28 });
    assert.deepEqual(artPose(.5, 1, 'gallery'), { x: 4, y: 21, turn: 3, scale: 1.14 });
    for (const kind of ['hinge', 'gallery', 'shutters-vertical']) {
        assert.deepEqual(artPose(1, 0, kind), { x: 0, y: 0, turn: 0, scale: 1 });
        assert.equal(Object.hasOwn(artPose(.5, 0, kind), 'opacity'), false);
    }
});

test('plan sheets, brochure leaves and calculator parts have distinct bounded geometry', () => {
    assert.deepEqual(fanPose(0, 0, 3, 'plans'), { x: -10, y: 18, turn: -2, scale: 1 });
    assert.deepEqual(fanPose(1, 0, 3, 'plans'), { x: -104, y: 6, turn: -9, scale: 1 });
    assert.deepEqual(fanPose(1, 2, 3, 'plans'), { x: 104, y: 6, turn: 9, scale: 1 });
    assert.deepEqual(fanPose(1, 0, 3, 'folio'), { x: -52, y: 4, turn: -18, scale: 1 });
    assert.deepEqual(fanPose(1, 1, 3, 'plans'), { x: 0, y: 0, turn: 0, scale: 1 });
    assert.deepEqual(balancePose(0, 0, 3), { x: -70, y: -20, turn: -24, scale: .45 });
    assert.deepEqual(balancePose(1, 0, 3), { x: 0, y: -34, turn: 0, scale: 1 });
    for (let progress = 0; progress <= 1; progress += .1) {
        for (let index = 0; index < 3; index++) {
            for (const pose of [fanPose(progress, index, 3, 'plans'), fanPose(progress, index, 3, 'folio'), balancePose(progress, index, 3)]) {
                assert(Object.values(pose).every(Number.isFinite));
                assert.equal(Object.hasOwn(pose, 'opacity'), false);
            }
        }
    }
});

class Target {
    constructor() { this.listeners = new Map(); }
    addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(listener); }
    emit(type, values = {}) { for (const listener of [...(this.listeners.get(type) || [])]) listener({ type, ...values }); }
}
class Element extends Target {
    constructor(tag, engine, attrs = {}) {
        super(); this.tagName = tag.toUpperCase(); this.engine = engine; this.attrs = { ...attrs };
        this.parentNode = null; this.children = []; this.styleWrites = []; this.hidden = Object.hasOwn(attrs, 'hidden');
        this.bounds = { top: 700, width: 800, height: 400 };
        this.className = attrs.class || '';
        this.classList = { add: (...names) => names.forEach(name => this.classes.add(name)), remove: (...names) => names.forEach(name => this.classes.delete(name)), contains: name => this.classes.has(name), toggle: (name, force) => { const on = force === undefined ? !this.classes.has(name) : force; if (on) this.classes.add(name); else this.classes.delete(name); return on; } };
        const node = this;
        this.style = { setProperty(name, value) { node.styleWrites.push([name, String(value)]); this[name] = String(value); }, getPropertyValue(name) { return this[name] || ''; } };
    }
    set className(value) { this.classes = new Set(String(value).split(/\s+/).filter(Boolean)); }
    get className() { return [...this.classes].join(' '); }
    get id() { return this.attrs.id || ''; }
    get parentElement() { return this.parentNode; }
    get firstElementChild() { return this.children[0] || null; }
    get dataset() { return Object.fromEntries(Object.entries(this.attrs).filter(([name]) => name.startsWith('data-')).map(([name, value]) => [name.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase()), value])); }
    append(...nodes) { for (const node of nodes) { if (node.parentNode) node.parentNode.children = node.parentNode.children.filter(child => child !== node); node.parentNode = this; this.children.push(node); } }
    replaceWith(node) { const parent = this.parentNode; const index = parent.children.indexOf(this); parent.children[index] = node; node.parentNode = parent; this.parentNode = null; }
    all() { return this.children.flatMap(child => [child, ...child.all()]); }
    contains(node) { return this === node || this.all().includes(node); }
    simpleMatch(selector) {
        let valid = true;
        const stripped = selector.replace(/\[([^=\]]+)(?:=["']?([^\]"']*)["']?)?\]/g, (_, name, value) => { valid &&= this.hasAttribute(name) && (value === undefined || this.getAttribute(name) === value); return ''; });
        const tag = stripped.match(/^[a-z][\w-]*/i)?.[0];
        if (tag && this.tagName !== tag.toUpperCase()) return false;
        for (const [, name] of stripped.matchAll(/\.([\w-]+)/g)) if (!this.classes.has(name)) return false;
        for (const [, id] of stripped.matchAll(/#([\w-]+)/g)) if (this.id !== id) return false;
        return valid;
    }
    matches(selector) {
        return selector.split(',').some(part => {
            const pieces = part.trim().replace(/\s*>\s*/g, ' > ').split(/\s+/);
            let node = this; let index = pieces.length - 1;
            if (!node.simpleMatch(pieces[index--])) return false;
            while (index >= 0) {
                if (pieces[index] === '>') { node = node.parentNode; index--; if (!node?.simpleMatch(pieces[index--])) return false; }
                else { const match = pieces[index--]; node = node.parentNode; while (node && !node.simpleMatch(match)) node = node.parentNode; if (!node) return false; }
            }
            return true;
        });
    }
    closest(selector) { let node = this; while (node) { if (node.matches(selector)) return node; node = node.parentNode; } return null; }
    querySelectorAll(selector) { return this.all().filter(node => node.matches(selector)); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    getAttribute(name) { return name === 'class' ? this.className : this.attrs[name] ?? null; }
    setAttribute(name, value) { if (name === 'class') this.className = value; else this.attrs[name] = String(value); }
    hasAttribute(name) { return Object.hasOwn(this.attrs, name); }
    removeAttribute(name) { delete this.attrs[name]; }
    getBoundingClientRect() {
        this.engine.reads++;
        this.engine.measured.push(this);
        let node = this;
        while (node) { if (node.hidden) return { top: 0, bottom: 0, width: 0, height: 0 }; node = node.parentNode; }
        const top = this.bounds.top - this.engine.window.scrollY + (this.classes.has('scene-art-layer') ? parseFloat(this.style['--scene-art-y']) || 0 : 0);
        return { ...this.bounds, top, bottom: top + this.bounds.height, left: 0, right: this.bounds.width };
    }
    focus() { this.engine.document.activeElement = this; this.engine.document.emit('focusin', { target: this }); }
}

function parse(markup, engine) {
    const host = new Element('document', engine); const stack = [host];
    const voids = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
    for (const match of markup.matchAll(/<(\/?)([a-z][\w-]*)([^>]*)>/gi)) {
        const tag = match[2].toLowerCase();
        if (match[1]) { const index = stack.findLastIndex(node => node.tagName === tag.toUpperCase()); if (index > 0) stack.length = index; continue; }
        const attrs = {};
        for (const attr of match[3].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[attr[1]] = attr[2] ?? attr[3] ?? attr[4] ?? '';
        const node = new Element(tag, engine, attrs); stack.at(-1).append(node);
        if (!voids.has(tag)) stack.push(node);
    }
    return host;
}

function fixture(page = 'concept', { width = 1440, height = 900, motion = true, saveData = false, reduced = false, raf = true, hideFirstGalleryItem = false, protectedHooks = false } = {}) {
    const f = { reads: 0, measured: [], created: [], frames: new Map(), nextFrame: 1, resizeObservers: [] };
    const window = f.window = new Target(); const document = f.document = new Target();
    const tree = f.tree = parse(fs.readFileSync(path.join(root, `${page}.html`), 'utf8'), f);
    const html = document.documentElement = tree.querySelector('html');
    const body = document.body = tree.querySelector('body'); document.activeElement = body;
    f.main = tree.querySelector('main');
    f.main.bounds.height = 7000;
    f.protectedHooks = [];
    if (protectedHooks) {
        const containers = [['form', {}], ['fieldset', {}], ['dialog', {}], ['div', { role: 'tabpanel' }], ['div', { role: 'status' }], ['div', { 'aria-live': 'polite' }], ['div', { id: 'site-plan-explorer' }], ['div', { class: 'finance-section' }], ['div', { class: 'viewing-form-column' }], ['div', { class: 'brochure-workspace' }], ['div', { id: 'brochure-preview' }]];
        for (const [tag, attrs] of containers) {
            const container = new Element(tag, f, attrs); f.main.append(container);
            const art = new Element('figure', f, { 'data-scene-art': 'hinge' }); container.append(art);
            const image = new Element('img', f, { src: 'protected.webp', alt: 'Protected tool illustration' }); art.append(image);
            const title = new Element('section', f, { 'data-scroll-scene': 'title' }); container.append(title);
            const line = new Element('span', f, { class: 'scene-title-line' }); title.append(line);
            f.protectedHooks.push({ art, image, title, line });
        }
    }
    document.querySelector = selector => tree.querySelector(selector); document.querySelectorAll = selector => tree.querySelectorAll(selector);
    document.createElement = tag => { const element = new Element(tag, f); f.created.push(element); return element; };
    document.getElementById = id => tree.all().find(node => node.id === id) || null;
    document.fonts = { ready: { then(callback) { f.fontsReady = callback; } } };
    const header = new Element('header', f, { class: 'site-header' }); header.bounds.height = width <= 800 ? 80 : 96; body.append(header);
    const connection = f.connection = new Target(); connection.saveData = saveData;
    const media = f.media = new Target(); media.matches = reduced; media.addListener = listener => media.addEventListener('change', listener);
    Object.assign(window, { innerWidth: width, innerHeight: height, scrollY: 0,
        navigator: { connection, hardwareConcurrency: 4, deviceMemory: 4, maxTouchPoints: width <= 800 ? 1 : 0 },
        matchMedia: () => media, getComputedStyle: () => ({ transform: 'none' }),
        requestAnimationFrame: raf ? callback => { const id = f.nextFrame++; f.frames.set(id, callback); return id; } : undefined,
        LioravennMotion: { isEnabled: () => motion, getMode: () => motion ? 'on' : 'off' }
    });
    f.title = f.main.querySelector('[data-scroll-scene="title"]');
    if (f.title) Object.assign(f.title.bounds, { top: 140, height: 560 });
    f.arts = f.main.querySelectorAll('[data-scene-art]').filter(element => !f.protectedHooks.some(hook => hook.art === element));
    f.arts.forEach((element, index) => { Object.assign(element.bounds, { top: 1100 + index * 700, height: 440 }); element.querySelectorAll('img').forEach(image => Object.assign(image.bounds, element.bounds)); });
    f.originalImages = f.main.querySelectorAll('img');
    f.originalControls = f.main.querySelectorAll('form,input,select,textarea,button,a,dialog,[role="tabpanel"]');
    f.imageAttrs = f.originalImages.map(image => [image, image.getAttribute('src'), image.getAttribute('alt')]);
    if (hideFirstGalleryItem) f.main.querySelector('.collection-item').hidden = true;
    window.ResizeObserver = class {
        constructor(callback) { this.callback = callback; this.targets = []; f.resizeObservers.push(this); }
        observe(element) { this.targets.push(element); }
        emit() { this.callback(this.targets.map(target => ({ target, contentRect: { width: target.bounds.width, height: target.bounds.height } }))); }
    };
    f.flush = () => { const callbacks = [...f.frames.values()]; f.frames.clear(); callbacks.forEach(callback => callback()); };
    f.scroll = y => { window.scrollY = y; window.emit('scroll'); f.flush(); };
    f.layout = () => { window.emit('lioravenn:layout-change'); f.flush(); };
    f.setMotion = value => { motion = value; window.emit('lioravenn:motion-change'); f.flush(); };
    f.saving = value => { connection.saveData = value; connection.emit('change'); f.flush(); };
    f.blur = () => { document.activeElement = body; document.emit('focusout'); f.flush(); f.flush(); };
    vm.runInNewContext(source, { window, document }, { filename });
    f.flush(); f.resizeObservers.forEach(observer => observer.emit()); f.flush();
    return f;
}

const number = (element, name) => parseFloat(element.style[name]);
function pose(element, prefix) { return { x: number(element, `${prefix}-x`), y: number(element, `${prefix}-y`), turn: number(element, `${prefix}-turn`), scale: number(element, `${prefix}-scale`) }; }
function artState(art) {
    const layer = art.querySelector('.scene-art-layer'); const curtains = art.querySelector('.scene-art-curtains');
    return {
        ...(layer ? { layer: pose(layer, '--scene-art') } : {}),
        ...(curtains ? { curtains: [number(curtains, '--scene-curtain-before'), number(curtains, '--scene-curtain-after')] } : {}),
        parts: art.querySelectorAll('[data-scene-part]').map(part => pose(part, '--scene-part')),
        ...(art.getAttribute('data-scene-art') === 'balance' ? { monogram: [number(art, '--scene-monogram-y'), number(art, '--scene-monogram-turn')] } : {}),
        ...(art.getAttribute('data-scene-art') === 'folio' ? { cover: number(art, '--scene-book-open') } : {})
    };
}
function snapshot(f) { return { title: f.title.querySelectorAll('.scene-title-line').map(line => [number(line, '--scene-title-x'), number(line, '--scene-title-turn')]), arts: f.arts.map(artState) }; }
function writes(f) { return f.tree.all().reduce((count, element) => count + element.styleWrites.length, 0); }

test('all six authored pages load scenes and provide safe editorial hooks', () => {
    const expectedKinds = { concept: 'hinge', 'floor-plans': 'plans', gallery: 'gallery', calculator: 'balance', contact: 'shutters-vertical', brochure: 'folio' };
    for (const page of pages) {
        const f = fixture(page);
        const html = fs.readFileSync(path.join(root, `${page}.html`), 'utf8');
        assert.match(html, /src="js\/scroll-scenes\.js(?:\?[^"\s]*)?"/, `${page} loads the controller`);
        assert.match(html, /href="css\/interior-scenes\.css(?:\?[^"\s]*)?"/, `${page} loads the interior scene styles`);
        assert(f.title, `${page} has a title scene`);
        assert(f.title.querySelectorAll('.scene-title-line').length >= 2, `${page} has original title lines inside moving wrappers`);
        assert(f.arts.some(art => art.getAttribute('data-scene-art') === expectedKinds[page]), `${page} has its distinctive artwork scene`);
        assert(f.document.documentElement.classList.contains('scene-motion-enabled'), `${page} initializes without homepage scene hooks`);
        for (const element of [f.title, ...f.arts]) assert.equal(element.closest('form,fieldset,dialog,[role="tabpanel"],[role="status"],[aria-live],#site-plan-explorer,.finance-section,.viewing-form-column,.brochure-workspace,#brochure-preview'), null, `${page} hooks remain outside tools and live previews`);
        for (const line of f.title.querySelectorAll('.scene-title-line')) assert(line.parentNode.classList.contains('sm-heading-line'), 'Existing heading line chunks remain the outer reading structure');
    }
});

test('title lines pull apart geometrically and reverse on desktop, 778px and phone', () => {
    for (const width of [1440, 778, 390, 320]) {
        const f = fixture('concept', { width });
        const header = width <= 800 ? 80 : 96;
        const halfway = 140 - header + 292.5;
        const final = 140 - header + 585;
        const lines = f.title.querySelectorAll('.scene-title-line');
        f.scroll(halfway);
        const halfTravel = Math.round(Math.min(180, width * .2) * 50) / 100;
        assert.equal(number(lines[0], '--scene-title-x'), -halfTravel);
        assert.equal(number(lines[1], '--scene-title-x'), halfTravel);
        assert.equal(number(lines[0], '--scene-title-turn'), 1);
        assert.equal(number(lines[1], '--scene-title-turn'), -1);
        const middle = snapshot(f).title;
        f.scroll(final); assert(Math.abs(number(lines[0], '--scene-title-x')) >= 64);
        f.scroll(0); assert.equal(number(lines[0], '--scene-title-x'), 0);
        f.scroll(halfway); assert.deepEqual(snapshot(f).title, middle);
    }
});

test('all six pages produce distinct geometric artwork poses and exact scroll reversal', () => {
    for (const page of pages) {
        const f = fixture(page);
        assert(f.arts.length > 0, `${page} provides an artwork`);
        const first = f.arts[0]; const kind = first.getAttribute('data-scene-art');
        const initial = artState(first);
        if (['hinge', 'gallery'].includes(kind)) assert.deepEqual(initial.layer, artPose(0, 0, kind));
        if (kind === 'shutters-vertical') assert.deepEqual(initial.curtains, [0, 0]);
        if (kind === 'plans' || kind === 'folio') assert(initial.parts.length >= 2, `${page} reuses multiple original sheets/leaves`);
        if (kind === 'balance') assert(initial.parts.some(part => part.scale === .45));
        const positions = [0, 300, 566, 842, 1100, 1396.5, 1800, 3500, 9000];
        const states = positions.map(y => { f.scroll(y); return snapshot(f); });
        assert.notDeepEqual(states[0].arts[0], states.at(-1).arts[0], `${page} visibly changes its artwork geometry`);
        positions.toReversed().forEach((y, index) => { f.scroll(y); assert.deepEqual(snapshot(f), states.at(-1 - index), `${page} returns to the same scene pose at the same document position`); });
        f.scroll(9000);
        const final = artState(first);
        if (['hinge', 'gallery'].includes(kind)) assert.deepEqual(final.layer, { x: 0, y: 0, turn: 0, scale: 1 });
        if (kind === 'shutters-vertical') assert.deepEqual(final.curtains, [-100, 100]);
        if (kind === 'folio') assert.equal(final.cover, -65);
        if (kind === 'balance') assert.deepEqual(final.monogram, [-140, 18]);
        assert(f.tree.all().every(element => element.styleWrites.every(([key]) => !key.includes('opacity'))), 'No interior scene is implemented through opacity changes');
    }
});

test('image preparation retains the same original image nodes, source attributes and controls', () => {
    for (const page of pages) {
        const f = fixture(page);
        for (const [image, src, alt] of f.imageAttrs) {
            assert(f.main.contains(image));
            assert.equal(image.getAttribute('src'), src);
            assert.equal(image.getAttribute('alt'), alt);
        }
        assert.equal(f.main.querySelectorAll('img').length, f.originalImages.length, 'No image is cloned or added');
        for (const control of f.originalControls) {
            assert(f.main.contains(control));
            assert.equal(control.styleWrites.length, 0, 'Forms, native image buttons and links are not transformed');
        }
        assert(f.created.every(element => element.tagName === 'DIV'), 'Preparation creates artwork containers only');
        for (const art of f.arts.filter(element => ['hinge', 'gallery', 'shutters-vertical'].includes(element.getAttribute('data-scene-art')))) {
            const image = art.querySelector('img');
            assert.equal(image.parentNode.className, 'scene-art-layer');
            assert.equal(image.parentNode.parentNode.className, 'scene-art-window');
        }
        for (const curtains of f.main.querySelectorAll('.scene-art-curtains')) assert.equal(curtains.getAttribute('aria-hidden'), 'true');
    }
});

test('ordinary scrolling coalesces frames, never reads geometry and avoids duplicate writes', () => {
    for (const page of pages) {
        const f = fixture(page);
        const reads = f.reads; const before = writes(f);
        f.window.emit('scroll'); f.window.emit('scroll'); f.window.emit('scroll');
        assert.equal(f.frames.size, 1); f.flush();
        assert.equal(f.frames.size, 0); assert.equal(writes(f), before);
        for (const y of [200, 700, 1100, 3000, 9000, 0]) f.scroll(y);
        assert.equal(f.reads, reads, `${page} scroll phases use cached flow geometry`);
        f.scroll(9000); const settled = writes(f); f.scroll(9100); f.scroll(9200);
        assert.equal(writes(f), settled, 'Finished distant scenes receive no repeated writes');
    }
});

test('gallery filtering remeasures newly visible artwork and skips hidden records', () => {
    const f = fixture('gallery', { hideFirstGalleryItem: true });
    const art = f.arts[0]; const owner = art.closest('button'); const layer = art.querySelector('.scene-art-layer');
    assert.equal(layer.styleWrites.length, 0, 'An initially filtered item is registered without an invalid hidden pose');
    owner.hidden = false; art.bounds.top = 1800; f.layout();
    assert.deepEqual(artState(art).layer, { x: -8, y: 42, turn: -6, scale: 1.28 });
    f.scroll(1542); assert.deepEqual(artState(art).layer, { x: 0, y: 0, turn: 0, scale: 1 });
    owner.hidden = true; f.layout();
    const hiddenWrites = layer.styleWrites.length; const reads = f.reads;
    f.scroll(100); f.scroll(9000); assert.equal(layer.styleWrites.length, hiddenWrites);
    assert.equal(f.reads, reads, 'Hidden artwork does not trigger geometry work during scroll');
    owner.hidden = false; art.bounds.top = 2600; f.layout(); f.scroll(1800);
    const expected = artPose(entranceProgress(1800, 900, 2600, 96), 0, 'gallery');
    assert.deepEqual(artState(art).layer, expected, 'Reappearing artwork uses its new stationary anchor');
    const gallerySource = fs.readFileSync(path.join(root, 'js/gallery.js'), 'utf8');
    assert.match(gallerySource, /lioravenn:layout-change/, 'The real gallery publishes layout changes after filtering/room changes');
});

test('gallery button focus reveals the full artwork while its native button remains stationary', () => {
    const f = fixture('gallery'); const art = f.arts[0]; const owner = art.closest('button');
    f.scroll(0); const before = artState(art); const reads = f.reads;
    for (const target of [owner, art.querySelector('img')]) {
        target.focus(); f.flush();
        assert.deepEqual(artState(art).layer, { x: 0, y: 0, turn: 0, scale: 1 });
        assert.equal(f.window.scrollY, 0);
        assert.equal(owner.styleWrites.length, 0);
        f.blur(); assert.deepEqual(artState(art), before);
    }
    f.main.focus(); f.flush(); assert.deepEqual(artState(art), before, 'Focusing a surrounding region does not freeze every image');
    assert.equal(f.reads, reads);
});

test('protected tool containers are ignored even if nested content accidentally receives a scene hook', () => {
    const f = fixture('concept', { protectedHooks: true });
    f.scroll(9000); f.scroll(0);
    for (const hook of f.protectedHooks) {
        assert.equal(hook.art.querySelector('.scene-art-window'), null);
        assert.equal(hook.image.parentNode, hook.art);
        assert.equal(hook.line.styleWrites.length, 0);
        assert.equal(hook.art.styleWrites.length, 0);
    }
    const preview = f.main.querySelector('#brochure-preview');
    const newArt = new Element('figure', f, { 'data-scene-art': 'hinge' }); const image = new Element('img', f, { src: 'rerender.webp' }); newArt.append(image); preview.append(newArt);
    f.layout(); f.scroll(8000);
    assert.equal(image.parentNode, newArt, 'Dynamic preview descendants are not discovered or wrapped on later layout refresh');
});

test('main size changes invalidate anchors once without per-scroll observers or feedback loops', () => {
    const f = fixture('concept'); f.scroll(566);
    const before = snapshot(f); const reads = f.reads;
    f.resizeObservers[0].emit(); f.resizeObservers[0].emit();
    assert.equal(f.frames.size, 0, 'Unchanged content measurements do not schedule a loop');
    assert.equal(f.reads, reads);
    f.main.bounds.height += 700; f.arts[0].bounds.top += 200;
    f.resizeObservers[0].emit(); f.resizeObservers[0].emit();
    assert.equal(f.frames.size, 1); f.flush();
    assert(f.reads > reads); assert.notDeepEqual(snapshot(f).arts[0], before.arts[0]);
    const updated = snapshot(f); f.layout(); assert.deepEqual(snapshot(f), updated, 'Re-measuring translated inner layers cannot drift the stationary artwork anchor');
    assert(f.measured.every(element => !element.classList.contains('scene-art-layer') && !element.classList.contains('scene-title-line')), 'Transformed layers and title lines are never used as flow anchors');
});

test('live Off/Save Data and unsupported enhancement keep native tools and restore static layout gates', () => {
    for (const page of pages) {
        const f = fixture(page); f.scroll(566); const active = snapshot(f);
        f.setMotion(false); assert.equal(f.document.documentElement.classList.contains('scene-motion-enabled'), false);
        const count = writes(f); f.scroll(800); f.scroll(566); assert.equal(writes(f), count);
        f.setMotion(true); assert.deepEqual(snapshot(f), active);
        f.saving(true); assert.equal(f.document.documentElement.classList.contains('scene-motion-enabled'), false);
        f.saving(false); assert.deepEqual(snapshot(f), active);
        const unsupported = fixture(page, { raf: false });
        assert.equal(unsupported.created.length, 0);
        assert.equal(unsupported.document.documentElement.classList.contains('scene-motion-enabled'), false);
    }
});

test('scene CSS gates dynamic geometry, defeats old fades, and keeps decorative curtains inert', () => {
    const rules = [...interiorCSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    const partRules = rules.filter(([, , declaration]) => /transform\s*:[^;]*var\(--scene-(?:part|book-open)/.test(declaration));
    assert(partRules.length >= 4, 'Each plans/balance/folio geometry target has its animated rule');
    for (const [, selector] of partRules) assert(selector.includes('.scene-motion-enabled'), `${selector.trim()} must ignore stale scene variables when motion is disabled`);
    assert.match(interiorCSS, /\.scene-motion-enabled\s+\[data-scene-art\]\s*,/, 'The formerly faded hook element itself is forced opaque');
    assert.match(interiorCSS, /\[data-scene-art\]\s+\.sm-image-reveal[^}]*opacity:\s*1!important/, 'Formerly faded descendants stay opaque too');
    assert.match(css, /\[data-scroll-scene\]\s+\.sm-heading-line[^}]*opacity:\s*1!important/, 'Old heading opacity no longer fights title geometry');
    assert.match(interiorCSS, /\.scene-art-curtains\s*\{[^}]*pointer-events:\s*none/);
    assert.match(interiorCSS, /\.scene-art-curtains\s*\{[^}]*display:\s*none/);
    assert.match(interiorCSS, /\.scene-motion-enabled\s+\.scene-art-curtains\s*\{[^}]*display:\s*block/);
    assert.match(interiorCSS, /\.collection-item:focus-visible\s+\.scene-art-layer\s*\{[^}]*transform:\s*none!important/);
    const print = interiorCSS.slice(interiorCSS.indexOf('@media print'));
    assert.match(print, /\.scene-title-line[^}]*transform:\s*none!important/);
    assert.match(print, /\.scene-book-display[^}]*display:\s*none!important/);
    const oldMotion = fs.readFileSync(path.join(root, 'js/scroll-motion.js'), 'utf8');
    assert(oldMotion.includes('[data-scene-art]') && oldMotion.includes('[data-scroll-scene]'), 'The old controller excludes both ownership hooks');
});

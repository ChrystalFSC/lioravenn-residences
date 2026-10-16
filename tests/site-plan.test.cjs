// Run: node tests/site-plan.test.cjs
// Dependency-free validation and DOM-fixture tests. Native keyboard behavior,
// focus visibility and visual layout are verified separately in a browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const { normaliseSelection, resolveSelection, selectionReference, blocks } = require(path.join(root, 'js/site-plan.js'));
const dataScript = fs.readFileSync(path.join(root, 'js/data.js'), 'utf8');
const pageScript = fs.readFileSync(path.join(root, 'js/site-plan.js'), 'utf8');
let modelChecks = 0;
let domChecks = 0;

function modelEqual(actual, expected) {
    assert.deepEqual(actual, expected);
    modelChecks++;
}
const baseline = { blockId: 'garden', floor: 'mid', view: 'garden', unitId: 'type-b' };
for (const invalid of [null, [], 'malformed', { blockId: '__proto__', floor: 'constructor', view: '<script>', unitId: 0 }]) modelEqual(normaliseSelection(invalid), baseline);
modelEqual(normaliseSelection({ blockId: 'park', floor: 'low', view: 'garden', unitId: 'type-c' }), { blockId: 'park', floor: 'low', view: 'park', unitId: 'type-b' });
modelEqual(normaliseSelection({ blockId: 'courtyard', floor: 'upper', view: 'pool', unitId: 'type-a' }), { blockId: 'courtyard', floor: 'upper', view: 'courtyard', unitId: 'type-c' });
modelEqual(normaliseSelection({ blockId: 'park', floor: 'upper', view: 'pool', unitId: 'type-c' }, ['type-a']), { blockId: 'garden', floor: 'mid', view: 'pool', unitId: 'type-a' });
modelEqual(normaliseSelection({}, []), null);
modelEqual(selectionReference(baseline), 'GC-M-GDN-B');
for (const invalid of [null, { ...baseline, floor: 'constructor' }, { ...baseline, unitId: 'invalid' }]) modelEqual(selectionReference(invalid), '');
for (const block of blocks) {
    for (const [floor, unitIds] of Object.entries(block.layouts)) {
        for (const view of block.views) {
            for (const unitId of unitIds) {
                const candidate = { blockId: block.id, floor, view, unitId };
                modelEqual(normaliseSelection(candidate), candidate);
                const query = new URLSearchParams({ block: block.id, level: floor, view, unit: unitId });
                const result = resolveSelection('?' + query, baseline);
                modelEqual(result.selection, candidate);
                modelEqual(result.fromLink, true);
                modelEqual(result.adjusted, false);
                assert(selectionReference(candidate));
                modelChecks++;
            }
        }
    }
}
const saved = { blockId: 'park', floor: 'upper', view: 'pool', unitId: 'type-c' };
modelEqual(resolveSelection('', saved).selection, saved);
modelEqual(resolveSelection('?utm_source=demo', saved).selection, saved);
modelEqual(resolveSelection('?block=garden&level=mid&view=garden&unit=type-b', saved).selection, baseline);
modelEqual(resolveSelection('?block=park&level=low&view=pool&unit=type-c', saved).selection, { blockId: 'park', floor: 'low', view: 'pool', unitId: 'type-b' });
modelEqual(resolveSelection('?block=park&level=low&view=pool&unit=type-c', saved).adjusted, true);
modelEqual(resolveSelection('?block=park&block=garden&unit=type-a', saved).adjusted, true);
modelEqual(resolveSelection('?block=&level=0&view=%3Csvg%3E&unit=invalid', saved).selection, baseline);
modelEqual(resolveSelection('?block=&level=0&view=%3Csvg%3E&unit=invalid', saved).adjusted, true);
modelEqual(resolveSelection('?unit=type-c', saved).selection, { ...baseline, unitId: 'type-c' });

class Element {
    constructor(attrs = {}) {
        this.attrs = attrs;
        this.dataset = {};
        for (const [key, value] of Object.entries(attrs)) {
            if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
        }
        this.nodes = [];
    }
    set innerHTML(value) {
        this.markup = value;
        this.nodes = [];
        for (const tag of value.matchAll(/<[a-z][a-z0-9-]*\b([^>]*?)>/gi)) {
            const attrs = {};
            for (const attr of tag[1].matchAll(/([^\s=]+)(?:="([^"]*)")?/g)) attrs[attr[1]] = attr[2] ?? '';
            this.nodes.push(new Element(attrs));
        }
    }
    get innerHTML() { return this.markup || ''; }
    all() { return this.nodes.flatMap(node => [node, ...node.all()]); }
    querySelectorAll(selector) { return this.all().filter(node => node.matches(selector)); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    matches(selector) {
        return selector.split(',').some(part => {
            part = part.trim();
            if (part.startsWith('#')) return this.attrs.id === part.slice(1);
            const match = part.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
            return !!match && Object.hasOwn(this.attrs, match[1]) && (match[2] === undefined || this.attrs[match[1]] === match[2]);
        });
    }
    closest(selector) { return this.matches(selector) ? this : null; }
    contains(node) { return this.all().includes(node); }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    addEventListener(name, callback) { (this.listeners ||= {})[name] = callback; }
    focus() { this.focused = true; }
}

function fixture(search = '', raw = null, noHost = false, blocked = false) {
    const host = new Element();
    const events = [];
    const writes = [];
    const cache = new Map(raw === null ? [] : [['lioravenn-site-selection', raw]]);
    const window = {
        location: { search, href: 'https://example.test/floor-plans.html' + search },
        history: { state: null, replaceState(state, title, url) { window.replaced = String(url); } },
        dispatchEvent(event) { events.push(event); },
        addEventListener() {}
    };
    const document = { getElementById(id) { return id === 'site-plan-explorer' && !noHost ? host : null; } };
    const localStorage = {
        getItem(key) { return cache.get(key) ?? null; },
        setItem(key, value) { if (blocked) throw new Error('Blocked'); cache.set(key, value); writes.push(value); }
    };
    const context = vm.createContext({
        window, document, localStorage, URL, URLSearchParams,
        CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } }
    });
    vm.runInContext(dataScript, context);
    vm.runInContext(pageScript, context);
    return {
        host, window, events, writes,
        get: id => host.querySelector('#' + id),
        state: () => JSON.parse(cache.get('lioravenn-site-selection') || 'null'),
        click(kind, value) {
            const target = host.querySelector(`[data-site-${kind}="${value}"]`);
            assert(target, 'Choice exists');
            host.listeners.click({ target });
        }
    };
}
function domEqual(actual, expected) {
    assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);
    domChecks++;
}
const f = fixture('?block=park&level=upper&view=pool&unit=type-c');
domEqual(f.state(), { blockId: 'park', floor: 'upper', view: 'pool', unitId: 'type-c' });
domEqual(f.events[0].type, 'lioravenn:site-selection');
domEqual(f.events[0].detail.unitReference, 'PP-U-POL-C');
domEqual(f.get('site-explore-layout').dataset.view, 'type-c');
assert(f.get('site-brochure-link').href.includes('unit=type-c'));
domChecks++;
f.click('block', 'courtyard');
domEqual(f.state(), { blockId: 'courtyard', floor: 'upper', view: 'courtyard', unitId: 'type-c' });
f.click('floor', 'low');
domEqual(f.state(), { blockId: 'courtyard', floor: 'low', view: 'courtyard', unitId: 'type-b' });
domEqual(f.get('site-explore-layout').dataset.view, 'type-b');
f.click('view', 'garden');
f.click('unit', 'type-a');
domEqual(f.state(), { blockId: 'courtyard', floor: 'low', view: 'garden', unitId: 'type-a' });
domEqual(f.events.at(-1).detail.unitReference, 'CH-L-GDN-A');
domEqual(f.events.length, 5);
domEqual(f.window.replaced, 'https://example.test/floor-plans.html?block=courtyard&level=low&view=garden&unit=type-a#site-plan');
domEqual(f.get('site-selection-link').href, 'floor-plans.html?block=courtyard&level=low&view=garden&unit=type-a#site-plan');
const reloaded = fixture('', JSON.stringify(f.state()));
domEqual(reloaded.state(), f.state());
const invalid = fixture('?block=invalid&level=bad&unit=bad');
assert(invalid.get('site-plan-status').textContent.includes('reset'));
domChecks++;
const noHost = fixture('', null, true);
domEqual(noHost.writes.length, 0);
domEqual(noHost.events.length, 0);
const blocked = fixture('', null, false, true);
domEqual(blocked.events.length, 1);
blocked.click('block', 'park');
domEqual(blocked.events.at(-1).detail.blockId, 'park');
const accessible = fixture();
domEqual(accessible.host.querySelectorAll('[data-site-block]').length, 6);
domEqual(accessible.host.querySelectorAll('[data-site-block]').filter(button => button.attrs['aria-pressed'] === 'true').length, 2);
domEqual(accessible.host.querySelectorAll('[data-site-floor]').length, 3);
domEqual(accessible.host.querySelectorAll('[data-site-view]').length, 2);
domEqual(accessible.host.querySelectorAll('[data-site-unit]').length, 3);
console.log(`Site plan: ${modelChecks} model assertions and ${domChecks} DOM-fixture assertions passed.`);

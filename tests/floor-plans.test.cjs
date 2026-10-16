// Dependency-free interaction tests using a small DOM fixture. Browser layout,
// native dialog keyboard behavior and focus restoration need separate UI QA.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'floor-plans.html'), 'utf8');
const dataScript = fs.readFileSync(path.join(root, 'js/data.js'), 'utf8');
const pageScript = fs.readFileSync(path.join(root, 'js/floor-plans.js'), 'utf8');

class Element {
    constructor(tag = 'div', attrs = {}, text = '') {
        this.tag = tag;
        this.attrs = attrs;
        this.id = attrs.id;
        this.dataset = Object.fromEntries(Object.entries(attrs).filter(([key]) => key.startsWith('data-')).map(([key, value]) => [key.slice(5), value]));
        this.textContent = text;
        this.value = attrs.value || '';
        this.checked = 'checked' in attrs;
        this.hidden = 'hidden' in attrs;
        this.disabled = 'disabled' in attrs;
        this.open = false;
        this.style = {};
        this.listeners = {};
        this.children = [];
    }
    addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); }
    emit(name, event = {}) { for (const listener of this.listeners[name] || []) listener(event); }
    set innerHTML(value) { this.markup = value; this.children = parseElements(value); }
    get innerHTML() { return this.markup || ''; }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    getAttribute(name) { return this.attrs[name]; }
    matches(selector) {
        const match = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
        return match ? match[1] in this.attrs && (match[2] === undefined || this.attrs[match[1]] === match[2]) : selector === this.tag;
    }
    closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector) || null; }
    querySelector(selector) { return this.children.find(child => child.matches(selector)) || null; }
    focus() { this.focused = true; }
    showModal() { this.open = true; }
    close() { this.open = false; this.emit('close'); }
}

function parseElements(markup) {
    const elements = [];
    const tags = /<([a-z][a-z0-9-]*)([^>]*?)>([^<]*)/gi;
    for (const tag of markup.matchAll(tags)) {
        const attrs = {};
        for (const attr of tag[2].matchAll(/([^\s=]+)(?:="([^"]*)")?/g)) attrs[attr[1]] = attr[2] ?? '';
        elements.push(new Element(tag[1], attrs, tag[3]));
    }
    return elements;
}

function fixture({ saved = null, search = '', hash = '', blocked = false, storage = new Map() } = {}) {
    if (saved !== null) storage.set('aurelle-favourites', saved);
    const staticNodes = parseElements(html);
    const ids = new Map(staticNodes.filter(node => node.id).map(node => [node.id, node]));
    const dynamicNodes = () => ['residence-grid', 'unit-dialog-content', 'comparison-content'].flatMap(id => ids.get(id).children);
    const document = new Element('document');
    document.body = new Element('body');
    document.getElementById = id => ids.get(id) || dynamicNodes().find(node => node.id === id);
    document.querySelectorAll = selector => [...staticNodes, ...dynamicNodes()].filter(node => node.matches(selector));
    const radios = staticNodes.filter(node => node.attrs.name === 'bedrooms');
    Object.defineProperty(radios, 'value', { get: () => radios.find(radio => radio.checked)?.value });
    const form = ids.get('home-filters');
    form.elements = { bedrooms: radios };
    ids.get('home-budget').value = 'all';
    form.reset = () => {
        form.emit('reset');
        radios.forEach(radio => { radio.checked = radio.value === 'all'; });
        ids.get('home-budget').value = 'all';
        ids.get('saved-only').checked = false;
    };
    for (const button of staticNodes.filter(node => 'data-close-dialog' in node.attrs)) button.parent = ids.get(button.attrs['aria-label'].includes('comparison') ? 'comparison-dialog' : 'unit-dialog');
    const pending = [];
    const window = new Element('window');
    window.location = { search, hash };
    window.setTimeout = callback => pending.push(callback);
    const localStorage = {
        getItem(key) { if (blocked) throw new Error('Unavailable storage'); return storage.get(key) ?? null; },
        setItem(key, value) { if (blocked) throw new Error('Unavailable storage'); storage.set(key, value); }
    };
    const context = vm.createContext({ window, document, localStorage, URLSearchParams });
    vm.runInContext(dataScript, context);
    vm.runInContext(pageScript, context);
    const node = id => document.getElementById(id);
    const click = target => document.emit('click', { target });
    return {
        window, node, storage,
        cards: () => node('residence-grid').children.filter(child => child.attrs.class === 'unit-card'),
        filter(bedrooms = 'all', budget = 'all', savedOnly = false) {
            radios.forEach(radio => { radio.checked = radio.value === bedrooms; });
            node('home-budget').value = budget;
            node('saved-only').checked = savedOnly;
            form.emit('change');
        },
        save(id) { click(node('residence-grid').querySelector(`[data-save="${id}"]`)); },
        view(id) { click(node('residence-grid').querySelector(`[data-view="${id}"]`)); },
        compare(id, checked = true) {
            const input = node('residence-grid').querySelector(`[data-compare="${id}"]`);
            input.checked = checked;
            document.emit('change', { target: input });
        },
        flush() { while (pending.length) pending.shift()(); }
    };
}

let assertions = 0;
const equal = (actual, expected, reason) => { assert.equal(actual, expected, reason); assertions++; };
{
    const f = fixture();
    equal(f.cards().length, 3, 'Initial collection has all homes');
    f.filter('2');
    equal(f.cards().length, 1, 'Bedroom filter narrows collection');
    equal(f.cards()[0].id, 'type-b', 'Two-bedroom result is correct');
    f.filter('2', '650000');
    equal(f.cards().length, 0, 'Budget intersects bedroom filter');
    equal(f.node('finder-empty').hidden, false, 'No matches reveals empty state');
    f.filter('all', 'all', true);
    equal(f.node('empty-description').textContent.includes('Tap the heart'), true, 'Empty favourites give a next step');
    f.node('empty-reset').emit('click');
    f.flush();
    equal(f.cards().length, 3, 'Empty-state reset restores all homes');
    f.filter('all', '850000');
    equal(f.cards().length, 2, 'Upper budget boundary is applied');
}
{
    const f = fixture();
    f.save('type-b');
    equal(f.node('saved-count').textContent, 1, 'Saving updates count');
    const reloaded = fixture({ storage: f.storage });
    reloaded.filter('all', 'all', true);
    equal(reloaded.cards().length, 1, 'Favourites survive page initialization');
    equal(reloaded.cards()[0].id, 'type-b', 'Stored home is restored correctly');
    reloaded.save('type-b');
    equal(reloaded.cards().length, 0, 'Removing saved home refreshes collection');
    equal(reloaded.node('finder-empty').hidden, false, 'Removing last saved home shows empty state');
    for (const [saved, expected] of [['broken json', 0], ['{}', 0], ['null', 0], ['["unknown", "type-a", "type-a", null]', 1]]) {
        const malformed = fixture({ saved });
        equal(malformed.node('saved-count').textContent, expected, 'Malformed, unknown and duplicated favourites are normalised');
    }
    const unavailable = fixture({ blocked: true });
    equal(unavailable.cards().length, 3, 'Unavailable storage does not break collection');
    unavailable.save('type-a');
    equal(unavailable.node('saved-count').textContent, 1, 'Session favourites remain usable when persistence is unavailable');
}
{
    const f = fixture();
    f.compare('type-a');
    equal(f.node('open-compare').disabled, true, 'Comparison needs at least two homes');
    f.compare('type-c');
    equal(f.node('open-compare').disabled, false, 'Two selected homes enable comparison');
    f.filter('2');
    f.node('open-compare').emit('click');
    equal(f.node('comparison-dialog').open, true, 'Comparison survives collection filtering');
    equal(f.node('comparison-content').innerHTML.includes('calculator.html?unit=type-c'), true, 'Comparison carries home selection into payment estimate');
    equal(f.node('comparison-brochure').href, 'brochure.html?units=type-a,type-c', 'Comparison brochure contains the exact selected homes');
    equal(f.node('comparison-content').innerHTML.includes('contact.html?unit=type-a'), true, 'Comparison carries home selection into enquiry');
    f.node('comparison-dialog').close();
    f.node('clear-compare').emit('click');
    equal(f.node('compare-tray').hidden, true, 'Clear removes comparison tray');
    f.view('type-b');
    equal(f.node('unit-dialog-title').textContent, 'The Luma', 'Details show chosen home');
    equal(f.node('unit-dialog-content').innerHTML.includes('contact.html?unit=type-b'), true, 'Details carry home selection into enquiry');
    equal(f.node('unit-dialog-content').innerHTML.includes('pdfs/type-b.pdf'), true, 'Details link to existing plan PDF');
    equal(f.node('unit-dialog-content').innerHTML.includes('brochure.html?unit=type-b'), true, 'Details carry the selected layout into a brochure');
    f.node('unit-dialog').close();
    equal(f.node('unit-dialog').open, false, 'Dialog close resets open state');
}
for (const [search, hash, title] of [['?unit=type-b', '', 'The Luma'], ['', '#type-a', 'The Solis'], ['?unit=invalid', '', null], ['?block=park&level=upper&view=pool&unit=type-c', '#site-plan', null], ['?unit=type-b', '#site-plan', null]]) {
    const f = fixture({ search, hash });
    equal(f.node('unit-dialog').open, title !== null, 'Deep links handle valid and unknown IDs');
    if (title) equal(f.node('unit-dialog-title').textContent, title, 'Deep link opens requested home');
}
for (const type of ['a', 'b', 'c']) {
    equal(fs.readFileSync(path.join(root, `pdfs/type-${type}.pdf`)).subarray(0, 5).toString(), '%PDF-', 'Downloadable plan is a PDF asset');
}
console.log(`Home finder: ${assertions} assertions passed (DOM mocks).`);

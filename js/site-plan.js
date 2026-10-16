(() => {
    'use strict';

    // These are design scenarios for a fictional development, not inventory.
    const blocks = [
        {
            id: 'garden', name: 'Garden Court', code: 'GC',
            description: 'Imagine a quieter setting framed by planting, with the garden woven into your daily routine.',
            views: ['garden', 'pool'],
            layouts: { low: ['type-a', 'type-b'], mid: ['type-a', 'type-b', 'type-c'], upper: ['type-b', 'type-c'] }
        },
        {
            id: 'courtyard', name: 'Courtyard House', code: 'CH',
            description: 'A concept centred on a shared courtyard: a place for an unhurried arrival and everyday connections.',
            views: ['courtyard', 'garden'],
            layouts: { low: ['type-a', 'type-b'], mid: ['type-b', 'type-c'], upper: ['type-c'] }
        },
        {
            id: 'park', name: 'Park Pavilion', code: 'PP',
            description: 'A family-minded concept that imagines open green spaces as a natural extension of home.',
            views: ['park', 'pool'],
            layouts: { low: ['type-b'], mid: ['type-b', 'type-c'], upper: ['type-c'] }
        }
    ];
    const floors = { low: 'Low level', mid: 'Mid level', upper: 'Upper level' };
    const viewNames = { garden: 'Garden outlook', courtyard: 'Courtyard outlook', park: 'Park outlook', pool: 'Pool outlook' };
    const viewCodes = { garden: 'GDN', courtyard: 'CT', park: 'PRK', pool: 'POL' };
    const defaultIds = ['type-a', 'type-b', 'type-c'];
    const storageKey = 'lioravenn-site-selection';

    function normaliseSelection(candidate, unitIds = defaultIds) {
        const input = candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? candidate : {};
        const knownUnits = new Set(Array.isArray(unitIds) ? unitIds : []);
        const supported = blocks.filter(block => Object.values(block.layouts).some(ids => ids.some(id => knownUnits.has(id))));
        if (!supported.length) return null;
        const block = supported.find(item => item.id === input.blockId) || supported[0];
        const supportedFloors = Object.keys(floors).filter(floor => block.layouts[floor].some(id => knownUnits.has(id)));
        const floor = supportedFloors.includes(input.floor) ? input.floor : supportedFloors.includes('mid') ? 'mid' : supportedFloors[0];
        const view = block.views.includes(input.view) ? input.view : block.views[0];
        const layouts = block.layouts[floor].filter(id => knownUnits.has(id));
        const unitId = layouts.includes(input.unitId) ? input.unitId : layouts.includes('type-b') ? 'type-b' : layouts[0];
        return { blockId: block.id, floor, view, unitId };
    }

    function resolveSelection(search, saved, unitIds = defaultIds) {
        const params = new URLSearchParams(search);
        const fields = { block: 'blockId', level: 'floor', view: 'view', unit: 'unitId' };
        const fromLink = Object.keys(fields).some(key => params.has(key));
        const input = fromLink ? {} : saved;
        let adjusted = false;
        if (fromLink) {
            for (const [parameter, field] of Object.entries(fields)) {
                const values = params.getAll(parameter);
                if (values.length === 1) input[field] = values[0];
                else if (values.length > 1) adjusted = true;
            }
        }
        const selection = normaliseSelection(input, unitIds);
        if (selection && fromLink) adjusted ||= Object.keys(selection).some(key => Object.hasOwn(input, key) && input[key] !== selection[key]);
        return { selection, fromLink, adjusted };
    }

    function selectionReference(selection) {
        const block = blocks.find(item => item.id === selection?.blockId);
        if (!block || !Object.hasOwn(floors, selection.floor) || !block.views.includes(selection.view) || !block.layouts[selection.floor].includes(selection.unitId)) return '';
        return `${block.code}-${selection.floor[0].toUpperCase()}-${viewCodes[selection.view]}-${selection.unitId.slice(-1).toUpperCase()}`;
    }

    // Pure rules are also usable in dependency-free Node validation checks.
    if (typeof module === 'object' && module.exports) module.exports = { normaliseSelection, resolveSelection, selectionReference, blocks };
    if (typeof document === 'undefined') return;
    const host = document.getElementById('site-plan-explorer');
    const app = window.Lioravenn;
    if (!host || !app || !Array.isArray(app.units)) return;
    const unitIds = app.units.map(unit => unit.id);
    const stored = app.storage.get(storageKey, null);
    const initial = resolveSelection(window.location.search, stored, unitIds);
    let selection = initial.selection;
    if (!selection) {
        host.innerHTML = '<p class="site-plan-note">The concept collection is being prepared. Explore the home layouts below.</p>';
        return;
    }

    const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

    function mapMarkup() {
        return `<div class="site-plan-map" aria-label="Illustrative concept diagram with three selectable blocks">
            <svg class="site-plan-illustration" viewBox="0 0 640 500" aria-hidden="true" focusable="false">
                <defs><pattern id="site-plan-paving" width="13" height="13" patternUnits="userSpaceOnUse"><path d="M13 0H0V13" fill="none" stroke="#d8d7c6" stroke-width=".6"/></pattern><pattern id="site-plan-water" width="32" height="15" patternUnits="userSpaceOnUse"><path d="M0 9c8-6 16 6 24 0s16 6 24 0" fill="none" stroke="#e1efea" stroke-width="1"/></pattern></defs>
                <path d="M60 30h485l60 55v320l-55 65H75l-40-45V80Z" fill="#e9ecdf" stroke="#d1d8c8" stroke-width="1.5"/>
                <path d="M75 425h475M300 425V280M300 280H100V220M300 280h220v-45" fill="none" stroke="#f8f6ee" stroke-width="33" stroke-linejoin="round"/>
                <path d="M75 425h475M300 425V280M300 280H100V220M300 280h220v-45" fill="none" stroke="url(#site-plan-paving)" stroke-width="25" stroke-linejoin="round"/>
                <path d="M55 360c42-31 56-49 66-93M168 44c30 15 42 34 52 62M450 40c-14 28-10 46 1 66M588 300c-28 0-36-9-44-28" fill="none" stroke="#b8c7aa" stroke-width="2" stroke-dasharray="3 6"/>
                <g fill="#cfdbc3" stroke="#b6c7aa" stroke-width="1"><circle cx="77" cy="59" r="18"/><circle cx="113" cy="42" r="13"/><circle cx="55" cy="108" r="12"/><circle cx="50" cy="250" r="19"/><circle cx="84" cy="258" r="14"/><circle cx="82" cy="296" r="23"/><circle cx="58" cy="338" r="16"/><circle cx="113" cy="340" r="14"/><circle cx="154" cy="384" r="20"/><circle cx="188" cy="365" r="13"/><circle cx="182" cy="323" r="21"/><circle cx="222" cy="343" r="16"/><circle cx="567" cy="59" r="19"/><circle cx="587" cy="111" r="12"/><circle cx="581" cy="251" r="22"/><circle cx="586" cy="289" r="14"/><circle cx="581" cy="340" r="20"/><circle cx="571" cy="380" r="12"/><circle cx="550" cy="448" r="14"/><circle cx="245" cy="453" r="10"/><circle cx="205" cy="449" r="15"/></g>
                <g fill="#b7c9ab"><circle cx="77" cy="59" r="5"/><circle cx="82" cy="296" r="7"/><circle cx="154" cy="384" r="6"/><circle cx="182" cy="323" r="6"/><circle cx="567" cy="59" r="6"/><circle cx="581" cy="251" r="7"/><circle cx="581" cy="340" r="6"/></g>
                <rect x="262" y="168" width="127" height="90" rx="41" fill="#e2d7be"/><rect x="271" y="177" width="109" height="72" rx="32" fill="#a3bfb7"/><rect x="271" y="177" width="109" height="72" rx="32" fill="url(#site-plan-water)"/>
                <g fill="#f8f6ee" stroke="#cfbea0" stroke-width="1"><rect x="242" y="188" width="10" height="24" rx="3"/><rect x="242" y="222" width="10" height="24" rx="3"/><rect x="399" y="188" width="10" height="24" rx="3"/><rect x="399" y="222" width="10" height="24" rx="3"/></g>
                <circle cx="300" cy="350" r="38" fill="#e3dec8" stroke="#d3cbb2"/><circle cx="300" cy="350" r="24" fill="#c4d2b7"/><path d="M276 350h48M300 326v48" stroke="#a5b796" stroke-width="1"/>
                <g fill="#dbdece" stroke="#b8bfab" stroke-width="1.2"><path d="M66 68h196v142H66Z"/><path d="M382 78h196v140H382Z"/><path d="M345 310h216v131H345Z"/></g>
                <g fill="none" stroke="#f8f6ee" stroke-width="2"><path d="M76 78h176v122H76ZM392 88h176v120H392ZM355 320h196v111H355Z"/></g>
                <g font-family="Manrope,Arial,sans-serif" fill="#65775e" text-anchor="middle"><text x="325" y="150" font-size="11" letter-spacing="1.8">THE POOL</text><text x="171" y="279" font-size="11" letter-spacing="1.5">GARDEN WALK</text><text x="300" y="402" font-size="11" letter-spacing="1.5">COURTYARD</text><text x="425" y="458" font-size="11" letter-spacing="1.6">ARRIVAL</text></g>
                <path d="M445 476v-16m-5 5 5-5 5 5" fill="none" stroke="#9b855c" stroke-width="1.5"/>
            </svg>
            <div class="site-map-blocks" role="group" aria-label="Choose a block on the concept diagram">
                ${blocks.map(block => `<button type="button" class="site-plan-block site-plan-block--${block.id}" data-site-block="${block.id}" aria-pressed="false" aria-controls="site-selection-panel"><span>${block.name.split(' ').map(escapeHtml).join('<br>')}</span></button>`).join('')}
            </div>
        </div>`;
    }

    host.innerHTML = `<div class="site-plan-layout">
        <div class="site-plan-overview"><figure class="site-plan-figure">${mapMarkup()}<figcaption>Choose a block on the diagram or use the buttons below.</figcaption></figure>
            <div class="site-block-list" role="group" aria-label="Choose a block from the list">${blocks.map(block => `<button type="button" data-site-block="${block.id}" aria-pressed="false" aria-controls="site-selection-panel"><span>${escapeHtml(block.name)}</span><span aria-hidden="true">↗</span></button>`).join('')}</div>
            <div class="site-plan-legend" aria-label="Diagram key"><span><i class="site-key-garden" aria-hidden="true"></i>Landscaped spaces</span><span><i class="site-key-pool" aria-hidden="true"></i>Concept pool</span><span><i class="site-key-path" aria-hidden="true"></i>Arrival & pathways</span></div>
        </div>
        <div class="site-selection-panel" id="site-selection-panel" aria-labelledby="site-selected-block">
            <p class="eyebrow">Your setting</p><h3 id="site-selected-block"></h3><p class="site-setting-description" id="site-setting-description"></p>
            <div class="site-choice-section"><h4 id="site-level-heading"><span>01</span> Choose a concept level</h4><div class="site-level-options" id="site-level-options" role="group" aria-labelledby="site-level-heading"></div></div>
            <div class="site-choice-section"><h4 id="site-view-heading"><span>02</span> Imagine your outlook</h4><div class="site-view-options" id="site-view-options" role="group" aria-labelledby="site-view-heading"></div></div>
            <div class="site-choice-section"><h4 id="site-layout-heading"><span>03</span> Explore a layout</h4><div class="site-layout-options" id="site-layout-options" role="group" aria-labelledby="site-layout-heading"></div></div>
            <div class="site-selection-summary"><span>Your illustrative reference</span><strong id="site-selection-reference"></strong><p>A design scenario to save with your favourite layout.</p></div>
            <div class="site-selection-actions"><a class="btn btn-primary" id="site-brochure-link" href="brochure.html">Add to my brochure <span aria-hidden="true">↗</span></a><button class="btn btn-outline" type="button" id="site-explore-layout">Explore this layout <span aria-hidden="true">→</span></button></div>
            <a class="site-selection-link" id="site-selection-link" href="floor-plans.html#site-plan">Link to this setting <span aria-hidden="true">↗</span></a>
        </div>
    </div><p class="site-plan-status" id="site-plan-status" role="status" aria-live="polite" aria-atomic="true"></p>`;

    const byId = id => host.querySelector(`#${id}`);
    function selectionUrl(page) {
        const params = new URLSearchParams({ block: selection.blockId, level: selection.floor, view: selection.view, unit: selection.unitId });
        return `${page}?${params}${page === 'floor-plans.html' ? '#site-plan' : ''}`;
    }

    function details() {
        const block = blocks.find(item => item.id === selection.blockId);
        return { ...selection, blockName: block.name, floorLabel: floors[selection.floor], viewLabel: viewNames[selection.view], unitReference: selectionReference(selection) };
    }

    function renderSelection(focusChoice) {
        const block = blocks.find(item => item.id === selection.blockId);
        const unit = app.units.find(item => item.id === selection.unitId);
        host.querySelectorAll('[data-site-block]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.siteBlock === selection.blockId)));
        byId('site-selected-block').textContent = block.name;
        byId('site-setting-description').textContent = block.description;
        byId('site-level-options').innerHTML = Object.entries(floors).map(([value, label]) => `<button type="button" data-site-floor="${value}" aria-pressed="${selection.floor === value}">${label.replace(' level', '')}</button>`).join('');
        byId('site-view-options').innerHTML = block.views.map(value => `<button type="button" data-site-view="${value}" aria-pressed="${selection.view === value}">${viewNames[value]}</button>`).join('');
        byId('site-layout-options').innerHTML = block.layouts[selection.floor].filter(id => unitIds.includes(id)).map(id => {
            const layout = app.units.find(item => item.id === id);
            return `<button type="button" class="site-layout-choice" data-site-unit="${escapeHtml(id)}" aria-pressed="${selection.unitId === id}"><span class="site-layout-top"><strong>${escapeHtml(layout.name)}</strong><span class="site-layout-check" aria-hidden="true">${selection.unitId === id ? '✓' : '+'}</span></span><span class="site-layout-spec">${layout.bedrooms} ${layout.bedrooms === 1 ? 'bedroom' : 'bedrooms'} · ${layout.area.toLocaleString('en-MY')} sq. ft.</span></button>`;
        }).join('');
        byId('site-selection-reference').textContent = selectionReference(selection);
        byId('site-brochure-link').href = selectionUrl('brochure.html');
        byId('site-explore-layout').dataset.view = unit.id;
        byId('site-explore-layout').setAttribute('aria-label', `Explore ${unit.name} layout`);
        byId('site-selection-link').href = selectionUrl('floor-plans.html');
        if (focusChoice) host.querySelector(`[data-site-${focusChoice.kind}="${focusChoice.value}"]`)?.focus({ preventScroll: true });
    }

    function persistAndNotify() {
        app.storage.set(storageKey, { ...selection });
        window.dispatchEvent(new CustomEvent('lioravenn:site-selection', { detail: details() }));
    }

    function updateAddress() {
        try {
            const url = new URL(window.location.href);
            url.searchParams.set('block', selection.blockId);
            url.searchParams.set('level', selection.floor);
            url.searchParams.set('view', selection.view);
            url.searchParams.set('unit', selection.unitId);
            url.hash = 'site-plan';
            window.history.replaceState(window.history.state, '', url);
        } catch { /* The share link remains available when browser history is restricted. */ }
    }

    host.addEventListener('click', event => {
        const button = event.target.closest('[data-site-block], [data-site-floor], [data-site-view], [data-site-unit]');
        if (!button || !host.contains(button)) return;
        const kinds = { block: 'blockId', floor: 'floor', view: 'view', unit: 'unitId' };
        const kind = Object.keys(kinds).find(key => Object.hasOwn(button.dataset, `site${key[0].toUpperCase()}${key.slice(1)}`));
        if (!kind) return;
        const value = button.dataset[`site${kind[0].toUpperCase()}${kind.slice(1)}`];
        const candidate = { ...selection, [kinds[kind]]: value };
        const next = normaliseSelection(candidate, unitIds);
        if (!next) return;
        const changed = Object.keys(next).some(key => next[key] !== selection[key]);
        selection = next;
        renderSelection(kind === 'block' ? null : { kind, value });
        if (changed) {
            persistAndNotify();
            updateAddress();
            const info = details();
            const unit = app.units.find(item => item.id === selection.unitId);
            byId('site-plan-status').textContent = `${info.blockName}, ${info.floorLabel.toLowerCase()}, ${info.viewLabel.toLowerCase()}, ${unit.name}. Concept selection updated.`;
        }
    });
    window.addEventListener('popstate', () => {
        const restored = resolveSelection(window.location.search, app.storage.get(storageKey, null), unitIds);
        if (!restored.selection) return;
        selection = restored.selection;
        renderSelection();
        persistAndNotify();
    });
    renderSelection();
    persistAndNotify();
    if (initial.adjusted) byId('site-plan-status').textContent = 'Some choices in this link were reset to supported concept options. You can explore the choices below.';
})();

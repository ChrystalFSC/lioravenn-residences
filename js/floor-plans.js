(() => {
    'use strict';

    const app = window.Lioravenn;
    if (!app || !Array.isArray(app.units)) return;

    const units = app.units;
    // Keep the original storage key so previously saved homes survive the rename.
    const storageKey = 'aurelle-favourites';
    const grid = document.getElementById('residence-grid');
    const filters = document.getElementById('home-filters');
    const resultsCount = document.getElementById('results-count');
    const emptyState = document.getElementById('finder-empty');
    const unitDialog = document.getElementById('unit-dialog');
    const comparisonDialog = document.getElementById('comparison-dialog');
    const comparisonTray = document.getElementById('compare-tray');
    const compareButton = document.getElementById('open-compare');
    const announcement = document.getElementById('finder-announcement');
    let favourites = readFavourites();
    const comparison = new Set();

    function readFavourites() {
        const stored = app.storage.get(storageKey, []);
        return new Set(Array.isArray(stored) ? stored.filter(id => units.some(unit => unit.id === id)) : []);
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
    }

    function stats(unit) {
        return `<dl class="unit-stats"><div><dt>${unit.bedrooms === 1 ? 'Bedroom' : 'Bedrooms'}</dt><dd>${unit.bedrooms}</dd></div><div><dt>${unit.bathrooms === 1 ? 'Bathroom' : 'Bathrooms'}</dt><dd>${unit.bathrooms}</dd></div><div><dt>Sq. ft.</dt><dd>${unit.area.toLocaleString('en-MY')}</dd></div></dl>`;
    }

    function compareChoice(unit) {
        return `<label class="compare-choice"><input type="checkbox" data-compare="${escapeHtml(unit.id)}" ${comparison.has(unit.id) ? 'checked' : ''} aria-label="Compare ${escapeHtml(unit.name)}"><span>Compare</span></label>`;
    }

    function card(unit) {
        const saved = favourites.has(unit.id);
        const number = String(units.indexOf(unit) + 1).padStart(2, '0');
        return `<article class="unit-card" id="${escapeHtml(unit.id)}" aria-labelledby="title-${escapeHtml(unit.id)}">
            <div class="unit-visual">
                <button class="unit-image-button" type="button" data-view="${escapeHtml(unit.id)}" aria-label="Explore ${escapeHtml(unit.name)}"><img src="${escapeHtml(unit.image)}" alt="Illustrative interior for ${escapeHtml(unit.name)}" width="800" height="600" loading="lazy"></button>
                <span class="unit-type">${escapeHtml(unit.label)}</span>
                <button class="unit-save" type="button" data-save="${escapeHtml(unit.id)}" aria-pressed="${saved}" aria-label="${saved ? 'Remove' : 'Save'} ${escapeHtml(unit.name)}${saved ? ' from favourites' : ' to favourites'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg></button>
            </div>
            <div class="unit-card-copy">
                <div class="unit-title-line"><h3 id="title-${escapeHtml(unit.id)}">${escapeHtml(unit.name)}</h3><span class="unit-number">NO. ${number}</span></div>
                <p class="unit-description">${escapeHtml(unit.description)}</p>
                ${stats(unit)}
                <p class="unit-price"><small>Illustrative price from</small>${escapeHtml(app.money(unit.price))}</p>
                <div class="unit-card-actions"><button class="text-link" type="button" data-view="${escapeHtml(unit.id)}">Explore this home <span aria-hidden="true">↗</span></button>${compareChoice(unit)}</div>
            </div>
        </article>`;
    }

    function renderHomes() {
        const bedroomValue = filters.elements.bedrooms.value;
        const budgetValue = document.getElementById('home-budget').value;
        const onlySaved = document.getElementById('saved-only').checked;
        const visible = units.filter(unit =>
            (bedroomValue === 'all' || unit.bedrooms === Number(bedroomValue)) &&
            (budgetValue === 'all' || unit.price <= Number(budgetValue)) &&
            (!onlySaved || favourites.has(unit.id))
        );

        grid.innerHTML = visible.map(card).join('');
        resultsCount.textContent = `${visible.length} ${visible.length === 1 ? 'home' : 'homes'} to discover${onlySaved ? ' · Your saved collection' : ''}`;
        emptyState.hidden = visible.length > 0;
        document.getElementById('empty-description').textContent = onlySaved && favourites.size === 0
            ? 'Tap the heart on a home to save it here for another look.'
            : 'Try a different bedroom count or budget to discover more homes.';
        document.getElementById('saved-count').textContent = favourites.size;
    }

    function toggleFavourite(id) {
        const unit = units.find(item => item.id === id);
        if (!unit) return;
        if (favourites.has(id)) favourites.delete(id);
        else favourites.add(id);
        app.storage.set(storageKey, [...favourites]);
        const saved = favourites.has(id);
        announcement.textContent = `${unit.name} ${saved ? 'saved to' : 'removed from'} your favourites.`;

        if (document.getElementById('saved-only').checked) {
            renderHomes();
            const nextButton = grid.querySelector('[data-save]');
            if (nextButton) nextButton.focus();
            else document.getElementById('empty-reset').focus();
        } else {
            document.querySelectorAll('[data-save]').forEach(button => {
                if (button.dataset.save !== id) return;
                button.setAttribute('aria-pressed', String(saved));
                button.setAttribute('aria-label', `${saved ? 'Remove' : 'Save'} ${unit.name} ${saved ? 'from' : 'to'} favourites`);
            });
        }
        document.getElementById('saved-count').textContent = favourites.size;
    }

    function updateComparison() {
        const selected = units.filter(unit => comparison.has(unit.id));
        comparisonTray.hidden = selected.length === 0;
        document.getElementById('compare-count').textContent = `${selected.length} ${selected.length === 1 ? 'home selected · Choose one more to compare' : 'homes selected'}`;
        document.getElementById('compare-names').textContent = selected.map(unit => unit.name).join(' · ');
        compareButton.disabled = selected.length < 2;
        document.querySelectorAll('[data-compare]').forEach(input => { input.checked = comparison.has(input.dataset.compare); });
    }

    function openDialog(dialog) {
        if (dialog.open) return;
        dialog.showModal();
        document.body.style.overflow = 'hidden';
    }

    function openUnit(id) {
        const unit = units.find(item => item.id === id);
        if (!unit) return;
        if (comparisonDialog.open) comparisonDialog.close();
        const query = `?unit=${encodeURIComponent(unit.id)}`;
        document.getElementById('unit-dialog-content').innerHTML = `<div class="unit-dialog-layout">
            <div class="unit-dialog-plan"><img src="${escapeHtml(unit.plan)}" alt="${escapeHtml(unit.label)} floor plan: ${unit.bedrooms} ${unit.bedrooms === 1 ? 'bedroom' : 'bedrooms'}, ${unit.bathrooms} ${unit.bathrooms === 1 ? 'bathroom' : 'bathrooms'}" width="444" height="600"><a href="${escapeHtml(unit.plan)}" target="_blank" rel="noopener">Open full-size floor plan <span aria-hidden="true">↗</span></a></div>
            <div class="unit-dialog-details"><p class="eyebrow">${escapeHtml(unit.label)} · The residence collection</p><h2 id="unit-dialog-title">${escapeHtml(unit.name)}</h2><p class="unit-dialog-description">${escapeHtml(unit.description)}</p>${stats(unit)}
                <p class="unit-price"><small>Illustrative price from</small>${escapeHtml(app.money(unit.price))}</p>
                <ul class="unit-highlights">${unit.features.map(feature => `<li>${escapeHtml(feature)}</li>`).join('')}</ul>
                <div class="unit-dialog-actions"><a class="btn btn-primary" href="contact.html${query}">Enquire about this home <span aria-hidden="true">↗</span></a><a class="btn btn-outline" href="calculator.html${query}">Estimate payments</a></div>
                <div class="unit-dialog-secondary"><a class="text-link" href="pdfs/${escapeHtml(unit.id)}.pdf" download>Download floor plan <span aria-hidden="true">↓</span></a><a class="text-link" href="brochure.html${query}">Build my brochure <span aria-hidden="true">↗</span></a>${compareChoice(unit)}</div>
                <p class="finder-disclaimer">Illustrative prices · Concept development. Layout and furniture shown for reference.</p>
            </div></div>`;
        openDialog(unitDialog);
    }

    function openComparison() {
        const selected = units.filter(unit => comparison.has(unit.id));
        if (selected.length < 2) return;
        document.getElementById('comparison-brochure').href = `brochure.html?units=${selected.map(unit => encodeURIComponent(unit.id)).join(',')}`;
        const row = (label, values) => `<tr><th scope="row">${label}</th>${values.map(value => `<td>${value}</td>`).join('')}</tr>`;
        document.getElementById('comparison-content').innerHTML = `<table class="comparison-table"><caption class="finder-sr-only">Comparison of ${selected.map(unit => escapeHtml(unit.name)).join(', ')}</caption><thead><tr><th scope="col">Your shortlist</th>${selected.map(unit => `<th scope="col"><img src="${escapeHtml(unit.image)}" alt="" width="320" height="220"><small>${escapeHtml(unit.label)}</small>${escapeHtml(unit.name)}</th>`).join('')}</tr></thead><tbody>
            ${row('Illustrative price', selected.map(unit => escapeHtml(app.money(unit.price))))}
            ${row('Bedrooms', selected.map(unit => unit.bedrooms))}
            ${row('Bathrooms', selected.map(unit => unit.bathrooms))}
            ${row('Floor area', selected.map(unit => `${unit.area.toLocaleString('en-MY')} sq. ft.`))}
            ${row('A sense of home', selected.map(unit => `<p>${escapeHtml(unit.description)}</p>`))}
            ${row('Your next step', selected.map(unit => `<div class="comparison-actions"><a class="text-link" href="calculator.html?unit=${encodeURIComponent(unit.id)}">Estimate payments →</a><a class="text-link" href="contact.html?unit=${encodeURIComponent(unit.id)}">Enquire about this home ↗</a><a class="text-link" href="pdfs/${escapeHtml(unit.id)}.pdf" download>Download plan ↓</a></div>`))}
            </tbody></table>`;
        if (unitDialog.open) unitDialog.close();
        openDialog(comparisonDialog);
    }

    function resetFilters() {
        filters.reset();
        renderHomes();
    }

    filters.addEventListener('change', renderHomes);
    filters.addEventListener('submit', event => event.preventDefault());
    filters.addEventListener('reset', () => { window.setTimeout(renderHomes, 0); });
    document.getElementById('empty-reset').addEventListener('click', () => { resetFilters(); filters.elements.bedrooms[0].focus(); });
    document.addEventListener('click', event => {
        const viewButton = event.target.closest('[data-view]');
        const saveButton = event.target.closest('[data-save]');
        if (viewButton) openUnit(viewButton.dataset.view);
        if (saveButton) toggleFavourite(saveButton.dataset.save);
        if (event.target.closest('[data-close-dialog]')) event.target.closest('dialog').close();
    });
    document.addEventListener('change', event => {
        if (!event.target.matches('[data-compare]')) return;
        const id = event.target.dataset.compare;
        if (event.target.checked) comparison.add(id);
        else comparison.delete(id);
        updateComparison();
        announcement.textContent = `${comparison.size} ${comparison.size === 1 ? 'home' : 'homes'} selected for comparison.`;
    });
    document.getElementById('clear-compare').addEventListener('click', () => {
        comparison.clear();
        updateComparison();
        grid.querySelector('[data-compare]')?.focus();
        announcement.textContent = 'Your comparison has been cleared.';
    });
    compareButton.addEventListener('click', openComparison);
    [unitDialog, comparisonDialog].forEach(dialog => {
        dialog.addEventListener('close', () => {
            if (!unitDialog.open && !comparisonDialog.open) document.body.style.overflow = '';
        });
        dialog.addEventListener('click', event => {
            if (event.target !== dialog) return;
            const rect = dialog.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
        });
    });
    window.addEventListener('storage', event => {
        if (event.key !== storageKey && event.key !== null) return;
        favourites = readFavourites();
        renderHomes();
    });
    window.addEventListener('hashchange', () => openUnit(window.location.hash.slice(1)));
    renderHomes();
    const query = new URLSearchParams(window.location.search);
    const linkedUnit = query.get('unit') || window.location.hash.slice(1);
    const exploringSite = ['block', 'level', 'view'].some(key => query.has(key)) || window.location.hash === '#site-plan';
    if (!exploringSite && units.some(unit => unit.id === linkedUnit)) openUnit(linkedUnit);
})();

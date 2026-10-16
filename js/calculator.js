(() => {
    'use strict';
    const app = window.Lioravenn;
    if (!app || !document.getElementById('finance-form')) return;
    const form = document.getElementById('finance-form');
    const unitSelect = document.getElementById('property-type');
    const error = document.getElementById('finance-error');
    const saveStatus = document.getElementById('save-status');
    const fields = ['property-price', 'down-payment', 'interest-rate', 'loan-term'];
    // Retain legacy keys so existing estimates and scenarios survive the rename.
    const saved = app.storage.get('aurelle-calculator', {});
    let scenarios = app.storage.get('aurelle-scenarios', []);
    if (!Array.isArray(scenarios)) scenarios = [];
    scenarios = scenarios.filter(isValidScenario).slice(0, 3);
    let current = null;

    function calculate(price, depositPercent, annualRate, years) {
        const deposit = price * depositPercent / 100;
        const principal = price - deposit;
        const months = years * 12;
        const rate = annualRate / 1200;
        const monthly = principal === 0 ? 0 : rate === 0 ? principal / months : principal * rate / -Math.expm1(-months * Math.log1p(rate));
        const total = monthly * months;
        return { price, depositPercent, annualRate, years, deposit, principal, monthly, total, interest: Math.max(0, total - principal) };
    }

    function isValidScenario(scenario) {
        return scenario && app.units.some(unit => unit.id === scenario.unit) &&
            Number.isFinite(scenario.price) && scenario.price >= 1000 && scenario.price <= 10000000 &&
            Number.isFinite(scenario.depositPercent) && scenario.depositPercent >= 0 && scenario.depositPercent <= 100 &&
            Number.isFinite(scenario.annualRate) && scenario.annualRate >= 0 && scenario.annualRate <= 15 &&
            Number.isInteger(scenario.years) && scenario.years >= 1 && scenario.years <= 35;
    }

    function selectedUnit() { return app.units.find(unit => unit.id === unitSelect.value) || app.units[0]; }
    function setText(id, text) { document.getElementById(id).textContent = text; }

    function update() {
        const valid = fields.every(id => document.getElementById(id).checkValidity());
        if (!valid) {
            current = null;
            error.hidden = false;
            error.textContent = 'Enter a price from RM 1,000 to RM 10,000,000, a deposit from 0–100%, a rate from 0–15%, and a whole-number term from 1–35 years.';
            document.getElementById('save-scenario').disabled = true;
            return;
        }
        error.hidden = true;
        const [price, depositPercent, annualRate, years] = fields.map(id => Number(document.getElementById(id).value));
        const result = calculate(price, depositPercent, annualRate, years);
        current = { unit: unitSelect.value, price, depositPercent, annualRate, years };
        const money = app.money;
        setText('monthly-payment', money(result.monthly));
        setText('repayment-period', `${years} ${years === 1 ? 'year' : 'years'}`);
        setText('loan-amount', money(result.principal));
        setText('total-interest', money(result.interest));
        setText('total-amount', money(result.total));
        setText('deposit-value', money(result.deposit));
        setText('deposit-summary', money(result.deposit));
        const degrees = result.total > 0 ? result.principal / result.total * 360 : 360;
        const ring = document.getElementById('repayment-ring');
        ring.style.background = `conic-gradient(#d8cba3 0deg ${degrees}deg, #789480 ${degrees}deg 360deg)`;
        ring.setAttribute('aria-label', `Loan principal ${money(result.principal)}. Total interest ${money(result.interest)}.`);
        const url = `contact.html?unit=${encodeURIComponent(unitSelect.value)}`;
        document.getElementById('enquire-unit').href = url;
        document.getElementById('finance-next-link').href = url;
        document.getElementById('calculator-brochure').href = `brochure.html?unit=${encodeURIComponent(unitSelect.value)}`;
        const unit = selectedUnit();
        setText('selected-home-detail', `${unit.bedrooms} ${unit.bedrooms === 1 ? 'bedroom' : 'bedrooms'} · ${unit.area.toLocaleString('en-MY')} sq ft · Sample price ${money(unit.price)}`);
        app.storage.set('aurelle-calculator', current);
        document.getElementById('save-scenario').disabled = scenarios.length >= 3;
    }

    function loadScenario(scenario) {
        unitSelect.value = scenario.unit;
        const values = [scenario.price, scenario.depositPercent, scenario.annualRate, scenario.years];
        fields.forEach((id, i) => {
            document.getElementById(id).value = values[i];
            syncSlider(id);
        });
        update();
    }

    function syncSlider(id) {
        const input = document.getElementById(id);
        const slider = document.getElementById(`${id}-slider`);
        const value = Number(input.value);
        if (id === 'property-price' && Number.isFinite(value) && input.checkValidity()) {
            slider.min = Math.min(100000, value);
            slider.max = Math.max(2000000, value);
            document.getElementById('price-hint').firstElementChild.textContent = app.money(Number(slider.min));
            document.getElementById('price-hint').lastElementChild.textContent = app.money(Number(slider.max));
        }
        slider.value = input.value;
    }

    function renderScenarios() {
        const section = document.getElementById('scenario-section');
        const list = document.getElementById('scenario-list');
        section.hidden = scenarios.length === 0;
        list.replaceChildren();
        scenarios.forEach((scenario, index) => {
            const result = calculate(scenario.price, scenario.depositPercent, scenario.annualRate, scenario.years);
            const unit = app.units.find(item => item.id === scenario.unit);
            const card = document.createElement('article');
            card.className = 'scenario-card';
            // Only trusted unit metadata and validated numbers are used in this template.
            card.innerHTML = `<span class="eyebrow">Scenario 0${index + 1} / ${unit.label}</span><h3>${unit.name}</h3><p class="scenario-payment">${app.money(result.monthly)}<span>/ month</span></p><dl><div><dt>Property price</dt><dd>${app.money(scenario.price)}</dd></div><div><dt>Deposit</dt><dd>${scenario.depositPercent}%</dd></div><div><dt>Rate / term</dt><dd>${scenario.annualRate}% / ${scenario.years} years</dd></div><div><dt>Total interest</dt><dd>${app.money(result.interest)}</dd></div></dl>`;
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = 'Use this scenario ↗';
            button.addEventListener('click', () => {
                loadScenario(scenario);
                form.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
                setText('save-status', `Scenario ${index + 1} loaded.`);
            });
            card.append(button);
            list.append(card);
        });
        document.getElementById('save-scenario').disabled = !current || scenarios.length >= 3;
    }

    fields.forEach(id => {
        const input = document.getElementById(id);
        const slider = document.getElementById(`${id}-slider`);
        input.addEventListener('input', () => { syncSlider(id); update(); saveStatus.textContent = ''; });
        slider.addEventListener('input', () => { input.value = slider.value; update(); saveStatus.textContent = ''; });
    });
    unitSelect.addEventListener('change', () => {
        document.getElementById('property-price').value = selectedUnit().price;
        syncSlider('property-price');
        const url = new URL(window.location.href);
        url.searchParams.set('unit', unitSelect.value);
        window.history.replaceState({}, '', url);
        update();
        saveStatus.textContent = '';
    });
    form.addEventListener('submit', event => { event.preventDefault(); update(); });
    document.getElementById('save-scenario').addEventListener('click', () => {
        if (!current || scenarios.length >= 3) return;
        if (scenarios.some(scenario => JSON.stringify(scenario) === JSON.stringify(current))) {
            saveStatus.textContent = 'This scenario is already in your comparison.';
            return;
        }
        scenarios.push({ ...current });
        app.storage.set('aurelle-scenarios', scenarios);
        renderScenarios();
        saveStatus.textContent = scenarios.length === 3 ? 'Three scenarios saved. Compare them below or clear to start again.' : 'Scenario saved. Your comparison is just below.';
    });
    document.getElementById('clear-scenarios').addEventListener('click', () => {
        scenarios = [];
        app.storage.set('aurelle-scenarios', scenarios);
        renderScenarios();
        saveStatus.textContent = 'Saved scenarios cleared.';
    });
    const urlUnit = new URLSearchParams(window.location.search).get('unit');
    const unit = app.units.find(item => item.id === urlUnit);
    if (unit) loadScenario({ unit: unit.id, price: unit.price, depositPercent: 10, annualRate: 4, years: 30 });
    else if (isValidScenario(saved)) loadScenario(saved);
    else update();
    renderScenarios();
})();

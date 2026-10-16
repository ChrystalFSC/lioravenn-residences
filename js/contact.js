(() => {
    'use strict';
    const app = window.Lioravenn;
    const form = document.getElementById('viewing-form');
    if (!app || !form) return;
    const unitSelect = document.getElementById('interest');
    const dateInput = document.getElementById('viewing-date');
    const method = document.getElementById('contact-method');
    const email = document.getElementById('email');
    const phone = document.getElementById('phone');
    const confirmation = document.getElementById('viewing-confirmation');
    const download = document.getElementById('download-request');
    let downloadUrl = null;

    function localToday() {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }
    dateInput.min = localToday();

    function selectedUnit() { return app.units.find(unit => unit.id === unitSelect.value) || app.units[0]; }

    function updateUnit() {
        const unit = selectedUnit();
        const image = document.getElementById('viewing-image');
        image.src = unit.image;
        image.alt = `A light-filled interior representing ${unit.name} at Lioravenn Residences`;
        document.getElementById('viewing-unit-label').textContent = `Your residence / ${unit.label}`;
        document.getElementById('viewing-unit-name').textContent = unit.name;
        document.getElementById('viewing-unit-spec').textContent = `${unit.bedrooms} ${unit.bedrooms === 1 ? 'bedroom' : 'bedrooms'} · ${unit.bathrooms} ${unit.bathrooms === 1 ? 'bathroom' : 'bathrooms'} · ${unit.area.toLocaleString('en-MY')} sq ft`;
        const link = document.getElementById('viewing-plan-link');
        link.href = `floor-plans.html?unit=${encodeURIComponent(unit.id)}`;
        link.setAttribute('aria-label', `Explore ${unit.name} floor plan`);
        document.getElementById('faq-calculator-link').href = `calculator.html?unit=${encodeURIComponent(unit.id)}`;
    }

    function updateMethod() {
        const useEmail = method.value === 'email';
        const usePhone = method.value === 'phone';
        document.getElementById('email-field').hidden = !useEmail;
        document.getElementById('phone-field').hidden = !usePhone;
        email.disabled = !useEmail;
        email.required = useEmail;
        phone.disabled = !usePhone;
        phone.required = usePhone;
        phone.setCustomValidity('');
    }

    function invalidateDraft() {
        confirmation.hidden = true;
        if (downloadUrl) {
            URL.revokeObjectURL(downloadUrl);
            downloadUrl = null;
        }
        download.removeAttribute('href');
    }

    function addSummary(label, value) {
        const row = document.createElement('div');
        const term = document.createElement('dt');
        const detail = document.createElement('dd');
        term.textContent = label;
        detail.textContent = value;
        row.append(term, detail);
        document.getElementById('request-summary').append(row);
    }

    unitSelect.addEventListener('change', () => {
        updateUnit();
        const url = new URL(window.location.href);
        url.searchParams.set('unit', unitSelect.value);
        window.history.replaceState({}, '', url);
    });
    method.addEventListener('change', updateMethod);
    form.addEventListener('input', invalidateDraft);
    form.addEventListener('change', invalidateDraft);
    phone.addEventListener('input', () => phone.setCustomValidity(''));
    dateInput.addEventListener('input', () => dateInput.setCustomValidity(''));

    form.addEventListener('submit', event => {
        event.preventDefault();
        // Re-check today's date in case this page has been open overnight.
        dateInput.min = localToday();
        dateInput.setCustomValidity(dateInput.value < dateInput.min ? 'Choose today or a future date.' : '');
        if (method.value === 'phone') {
            const digits = phone.value.replace(/\D/g, '');
            const valid = /^[+\d\s().-]+$/.test(phone.value) && digits.length >= 7 && digits.length <= 15;
            phone.setCustomValidity(valid ? '' : 'Enter a phone number with 7 to 15 digits.');
        }
        if (!form.reportValidity()) return;
        invalidateDraft();
        const unit = selectedUnit();
        const date = new Date(`${dateInput.value}T12:00:00`).toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const time = document.getElementById('viewing-time').value;
        const name = document.getElementById('name').value.trim();
        const message = document.getElementById('message').value.trim();
        const contactMethod = method.value === 'email' ? 'Email' : method.value === 'phone' ? 'Phone' : 'Decide later';
        const contactValue = method.value === 'email' ? email.value.trim() : method.value === 'phone' ? phone.value.trim() : '';
        const rows = [['Residence', `${unit.name} / ${unit.label}`], ['Date', date], ['Time', time], ['Contact', contactValue ? `${contactMethod}: ${contactValue}` : contactMethod]];
        if (name) rows.push(['Name', name]);
        if (message) rows.push(['Notes', message]);
        document.getElementById('request-summary').replaceChildren();
        rows.forEach(([label, value]) => addSummary(label, value));
        const text = ['LIORAVENN RESIDENCES', 'Personal viewing request · CONCEPT DEMONSTRATION', '', 'This is a draft only. No enquiry was sent and no appointment is booked.', '', ...rows.map(([label, value]) => `${label}: ${value}`), '', 'Lioravenn is a simulated residence created for a university website project.'].join('\r\n');
        downloadUrl = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
        download.href = downloadUrl;
        confirmation.hidden = false;
        confirmation.focus({ preventScroll: true });
        confirmation.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    });
    document.getElementById('edit-request').addEventListener('click', () => {
        invalidateDraft();
        unitSelect.focus();
        form.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    });
    window.addEventListener('pagehide', () => { if (downloadUrl) URL.revokeObjectURL(downloadUrl); });
    const urlUnit = new URLSearchParams(window.location.search).get('unit');
    if (app.units.some(unit => unit.id === urlUnit)) unitSelect.value = urlUnit;
    updateUnit();
    updateMethod();
})();

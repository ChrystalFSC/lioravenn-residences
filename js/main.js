(() => {
  'use strict';
  const monogram = `<svg viewBox="0 0 42 52" fill="none" focusable="false"><path d="M5 47V13l8-8h16l8 8v34H5Z" stroke="currentColor" stroke-width="1.1"/><path d="M10 42V16l6-6h10l6 6v26H10Z" stroke="currentColor" stroke-width=".8"/><path d="M16 17h4v18h9v4H16V17Z" fill="currentColor"/></svg>`;
  const brand = `<span class="brand-mark" aria-hidden="true">${monogram}</span><span class="brand-type"><span class="brand-name">LIORAVENN</span><span class="brand-subtitle">RESIDENCES</span></span>`;
  const pages = [['index.html', 'The Residence'], ['floor-plans.html', 'Our Homes'], ['concept.html', 'The Lifestyle'], ['gallery.html', 'The Collection'], ['calculator.html', 'Plan Your Purchase']];
  const current = location.pathname.split('/').filter(Boolean).pop() || 'index.html';
  const isCurrent = href => current === href || current === href.replace('.html', '');
  const headerHost = document.getElementById('site-header');
  if (headerHost) headerHost.innerHTML = `<a class="skip-link" href="#main-content">Skip to content</a><header class="site-header"><div class="container header-inner"><a class="brand" href="index.html" aria-label="Lioravenn Residences home">${brand}</a><button class="menu-button" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="primary-navigation"><span></span><span></span></button><nav class="site-nav" id="primary-navigation" aria-label="Main navigation">${pages.map(([href,label]) => `<a href="${href}"${isCurrent(href) ? ' aria-current="page"' : ''}>${label}</a>`).join('')}<a class="nav-cta" href="contact.html"${isCurrent('contact.html') ? ' aria-current="page"' : ''}>Plan a Viewing <span aria-hidden="true">↗</span></a></nav></div></header>`;
  const footerHost = document.getElementById('site-footer');
  if (footerHost) footerHost.innerHTML = `<footer class="site-footer"><div class="container"><div class="footer-top"><div class="footer-about"><a class="brand" href="index.html" aria-label="Lioravenn Residences home">${brand}</a><p>A considered collection of homes.<br>A quieter kind of extraordinary.</p><span class="eyebrow">The art of coming home</span></div><div><h2 class="footer-title">Discover Lioravenn</h2><div class="footer-links">${pages.map(([href,label]) => `<a href="${href}">${label}</a>`).join('')}<a href="floor-plans.html#site-plan">Concept site plan</a><a href="brochure.html">Your personal brochure</a></div></div><div class="footer-invitation"><div><h2 class="footer-title">Your next chapter</h2><h3>Find your place.<br>Feel at home.</h3></div><a class="text-link" href="contact.html">Plan a viewing <span aria-hidden="true">↗</span></a></div></div><div class="footer-bottom"><p>© ${new Date().getFullYear()} Lioravenn Residences. A university concept, reimagined.<br>All imagery, prices and amenities are illustrative. This is a simulated development; viewing requests are demonstrations.</p><a href="contact.html#privacy">Privacy & demo information ↗</a></div></div></footer>${!isCurrent('contact.html') ? '<div class="mobile-viewing"><span>Your next chapter.</span><a class="btn btn-primary" href="contact.html">Plan a viewing ↗</a></div>' : ''}`;
  const menu = document.querySelector('.menu-button');
  const nav = document.querySelector('.site-nav');
  function closeMenu() { nav?.classList.remove('is-open'); menu?.setAttribute('aria-expanded', 'false'); menu?.setAttribute('aria-label', 'Open navigation'); }
  menu?.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation'); nav.classList.toggle('is-open', open); });
  nav?.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav?.classList.contains('is-open')) { closeMenu(); menu.focus(); } });
  document.addEventListener('click', e => { if (!e.target.closest('.site-header')) closeMenu(); });
  const main = document.querySelector('main');
  if (main && !main.id) main.id = 'main-content';
  const header = document.querySelector('.site-header');
  window.addEventListener('scroll', () => header?.classList.toggle('scrolled', window.scrollY > 20), { passive: true });
})();

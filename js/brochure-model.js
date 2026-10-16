(() => {
  'use strict';
  const defaults = { depositPercent: 10, annualRate: 4, years: 30 };
  const blocks = { garden: { name: 'Garden Court', views: ['garden','pool'] }, courtyard: { name: 'Courtyard House', views: ['courtyard','garden'] }, park: { name: 'Park Pavilion', views: ['park','pool'] } };
  const layouts = { garden: { low:['type-a','type-b'],mid:['type-a','type-b','type-c'],upper:['type-b','type-c'] }, courtyard: { low:['type-a','type-b'],mid:['type-b','type-c'],upper:['type-c'] }, park: { low:['type-b'],mid:['type-b','type-c'],upper:['type-c'] } };
  const number = value => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') ? Number(value) : NaN;
  function assumptions(value) {
    if (!value || typeof value !== 'object') return null;
    const depositPercent = number(value.depositPercent), annualRate = number(value.annualRate), years = number(value.years);
    return Number.isFinite(depositPercent) && depositPercent >= 0 && depositPercent <= 100 && Number.isFinite(annualRate) && annualRate >= 0 && annualRate <= 15 && Number.isInteger(years) && years >= 1 && years <= 35 ? {depositPercent,annualRate,years} : null;
  }
  function estimate(price, value) {
    const a = assumptions(value);
    if (!a || !Number.isFinite(price) || price < 0) return null;
    const deposit = price * a.depositPercent / 100, principal = price - deposit, months = a.years * 12, rate = a.annualRate / 1200;
    const monthly = principal === 0 ? 0 : rate === 0 ? principal / months : principal * rate / -Math.expm1(-months * Math.log1p(rate));
    return {deposit,principal,monthly,total:monthly*months};
  }
  function unitIds(value, units) { return Array.isArray(value) ? [...new Set(value.filter(id => units.some(unit => unit.id === id)))] : []; }
  function siteSelection(value, units) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(blocks, value.blockId)) return null;
    const block = blocks[value.blockId];
    if (!Object.hasOwn(layouts[value.blockId], value.floor) || !block.views.includes(value.view) || !layouts[value.blockId][value.floor].includes(value.unitId) || !units.some(unit=>unit.id===value.unitId)) return null;
    const floor = {low:'Lower levels',mid:'Middle levels',upper:'Upper levels'}[value.floor];
    const view = {garden:'Garden outlook',pool:'Pool outlook',courtyard:'Courtyard outlook',park:'Park outlook'}[value.view];
    return {blockId:value.blockId,floor:value.floor,view:value.view,unitId:value.unitId,label:`${block.name} · ${floor} · ${view}`};
  }
  const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const api = {defaults,assumptions,estimate,unitIds,siteSelection,escapeHtml};
  if (typeof window !== 'undefined') window.LioravennBrochure = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();

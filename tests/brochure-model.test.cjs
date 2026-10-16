// Run: node tests/brochure-model.test.cjs
// Pure contract checks; rendered PDF layout and browser download behavior require QA.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const model = require('../js/brochure-model.js');
const sitePlan = require('../js/site-plan.js');
const root = path.resolve(__dirname, '..');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/data.js'), 'utf8'), context);
const units = JSON.parse(JSON.stringify(context.window.Lioravenn.units));
const defaults = { depositPercent: 10, annualRate: 4, years: 30 };
const calculatorSource = fs.readFileSync(path.join(root, 'js/calculator.js'), 'utf8');
const calculatorMatch = calculatorSource.match(/function calculate\([^)]*\)\s*\{[\s\S]*?\n    \}/);
assert.ok(calculatorMatch, 'The existing calculator function remains available for the continuity check');
const calculator = vm.runInNewContext(`(${calculatorMatch[0]})`);
const close = (actual, expected, tolerance = 1e-7) => assert.ok(
  Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
  `Expected finite ${actual} to be within ${tolerance} of ${expected}`
);

test('assumptions accept decimal percentages and stored numeric strings without mutating input', () => {
  const input = { depositPercent: ' 20.5 ', annualRate: '4.25', years: '35', unit: 'type-b' };
  const before = JSON.stringify(input);
  assert.deepEqual(model.assumptions(input), { depositPercent: 20.5, annualRate: 4.25, years: 35 });
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(model.assumptions({ depositPercent: 0, annualRate: 0, years: 1 }), { depositPercent: 0, annualRate: 0, years: 1 });
  assert.deepEqual(model.assumptions({ depositPercent: 100, annualRate: 15, years: 35 }), { depositPercent: 100, annualRate: 15, years: 35 });
});

test('assumptions reject empty, nonnumeric, missing and out-of-range values', () => {
  for (const input of [null, undefined, false, [], {}, '10']) assert.equal(model.assumptions(input), null);
  for (const [field, values] of Object.entries({
    depositPercent: ['', ' ', null, true, -1, 101, NaN, Infinity],
    annualRate: ['', null, -0.01, 15.01, NaN, Infinity, 'not a rate'],
    years: ['', null, 0, 36, 30.5, NaN, Infinity]
  })) for (const value of values) assert.equal(model.assumptions({ ...defaults, [field]: value }), null, `${field}: ${String(value)}`);
});

test('standard brochure estimates preserve the calculator journey and RM rounding', () => {
  for (const [price, rounded] of [[580000, 2492], [720000, 3094], [960000, 4125]]) {
    const result = model.estimate(price, defaults);
    assert.equal(Math.round(result.monthly), rounded);
    close(result.deposit + result.principal, price);
    close(result.total, result.monthly * 360);
  }
  for (const price of [580000, 720000, 960000]) for (const depositPercent of [0, 10, 100]) {
    for (const annualRate of [0, 4, 15]) for (const years of [1, 30, 35]) {
      const result = model.estimate(price, { depositPercent, annualRate, years });
      const existing = calculator(price, depositPercent, annualRate, years);
      for (const field of ['deposit', 'principal', 'monthly', 'total']) close(result[field], existing[field]);
    }
  }
});

test('zero-interest and fully paid homes never produce NaN or residual loan payments', () => {
  assert.deepEqual(model.estimate(720000, { depositPercent: 20, annualRate: 0, years: 30 }), {
    deposit: 144000, principal: 576000, monthly: 1600, total: 576000
  });
  assert.deepEqual(model.estimate(960000, { depositPercent: 100, annualRate: 4, years: 30 }), {
    deposit: 960000, principal: 0, monthly: 0, total: 0
  });
  assert.deepEqual(model.estimate(0, defaults), { deposit: 0, principal: 0, monthly: 0, total: 0 });
  for (const price of [-1, NaN, Infinity, '720000', null]) assert.equal(model.estimate(price, defaults), null);
  assert.equal(model.estimate(720000, { ...defaults, years: 0 }), null);
});

test('valid rates close to zero stay finite and approach the interest-free result', () => {
  for (const annualRate of [1e-15, 1e-12]) {
    const result = model.estimate(720000, { depositPercent: 20, annualRate, years: 30 });
    close(result.monthly, 1600, 1e-6);
    close(result.total, 576000, 1e-3);
    close(calculator(720000, 20, annualRate, 30).monthly, result.monthly, 1e-6);
  }
});

test('saved home IDs are allowlisted and deduplicated while preserving order', () => {
  const input = ['type-c', 'type-a', 'unknown', 'type-c', null, { id: 'type-b' }];
  const before = JSON.stringify(input);
  assert.deepEqual(model.unitIds(input, units), ['type-c', 'type-a']);
  assert.equal(JSON.stringify(input), before);
  for (const value of [null, undefined, {}, 'type-a', false]) assert.deepEqual(model.unitIds(value, units), []);
  assert.deepEqual(model.unitIds(['type-a'], []), []);
});

test('brochure site rules remain consistent with every supported plan combination', () => {
  for (const block of sitePlan.blocks) for (const [floor, ids] of Object.entries(block.layouts)) {
    for (const view of ['garden', 'pool', 'courtyard', 'park']) for (const unit of units) {
      const input = { blockId: block.id, floor, view, unitId: unit.id };
      const result = model.siteSelection(input, units);
      const valid = block.views.includes(view) && ids.includes(unit.id);
      assert.equal(Boolean(result), valid, JSON.stringify(input));
      if (valid) {
        assert.equal(result.unitId, unit.id);
        assert.ok(result.label.startsWith(block.name + ' · '));
        assert.equal(model.siteSelection(input, units.filter(candidate => candidate.id !== unit.id)), null);
      }
    }
  }
  for (const input of [null, {}, { blockId: '__proto__' }, { blockId: 'constructor' }, {
    blockId: 'garden', floor: 'constructor', view: 'garden', unitId: 'type-a'
  }]) assert.equal(model.siteSelection(input, units), null);
});

test('untrusted notes escape markup while preserving their visible Unicode content', () => {
  const input = '<img src=x onerror="alert(1)"> & \'你好\'\nSecond line';
  const escaped = model.escapeHtml(input);
  assert.equal(escaped, '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;你好&#39;\nSecond line');
  assert.equal(/[<>]/.test(escaped), false);
});

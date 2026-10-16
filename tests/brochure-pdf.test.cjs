// Run: node tests/brochure-pdf.test.cjs
// Uses the real bundled jsPDF for font metrics, text layout, pages and output.
// Only image insertion is stubbed; image export and visual styling need browser QA.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { jsPDF } = require('../js/vendor/jspdf.umd.min.js');
const brochure = require('../js/brochure-pdf.js');
const model = require('../js/brochure-model.js');
const root = path.resolve(__dirname, '..');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/data.js'), 'utf8'), context);
const units = JSON.parse(JSON.stringify(context.window.Lioravenn.units));
const site = { blockId: 'garden', floor: 'mid', view: 'garden', unitId: 'type-b' };

async function prepare(notes, overrides = {}) {
  const calls = [];
  let imageLoads = 0;
  function AuditedPDF(options) {
    const doc = new jsPDF(options);
    const original = doc.text;
    doc.addImage = function () { return this; };
    doc.text = function (content, x, y, options = {}) {
      const lines = Array.isArray(content) ? content : [content];
      const size = doc.getFontSize();
      const spacing = size * 25.4 / 72 * (options.lineHeightFactor || 1.15);
      lines.forEach((text, index) => calls.push({
        text: String(text), x, y: y + index * spacing, size,
        page: doc.internal.getCurrentPageInfo().pageNumber
      }));
      return original.call(this, content, x, y, options);
    };
    return doc;
  }
  const data = { units, assumptions: model.defaults, notes, site, ...overrides };
  const doc = await brochure.create(data, {
    model, jsPDF: AuditedPDF,
    async loadImage() { imageLoads++; return { src: 'image-layout-placeholder', width: 1000, height: 700 }; }
  });
  const summaryPage = data.units.length + 2;
  const noteCalls = calls.filter(call => call.page >= summaryPage && call.size === 9.5);
  return { doc, calls, noteCalls, imageLoads };
}

function notesStayInsidePage(result) {
  assert.ok(result.noteCalls.length > 0, 'Notes are rendered');
  for (const call of result.noteCalls) {
    assert.ok(call.y <= 270, `Page ${call.page} note baseline ${call.y} is above the content limit`);
    assert.ok(call.y >= 45, `Page ${call.page} notes do not overlap the header`);
  }
}

test('30 viewing questions with three homes and site selection paginate to six pages', async () => {
  const questions = Array.from({ length: 30 }, (_, index) => `Question ${String(index + 1).padStart(2, '0')}?`);
  const result = await prepare(questions.join('\n'));
  assert.equal(result.doc.getNumberOfPages(), 6);
  assert.deepEqual(result.noteCalls.map(call => call.text), questions, 'Every question appears exactly once and in order');
  assert.deepEqual([...new Set(result.noteCalls.map(call => call.page))], [5, 6]);
  notesStayInsidePage(result);
  for (let page = 1; page <= 6; page++) {
    assert.ok(result.calls.some(call => call.page === page && call.text === `${page} / 6`), 'Footer page totals include the added notes page');
  }
});

test('the full 600-character multiline allowance preserves every short question', async () => {
  const notes = 'Q\n'.repeat(300);
  assert.equal(notes.length, 600);
  const result = await prepare(notes);
  assert.equal(result.noteCalls.filter(call => call.text === 'Q').length, 300);
  assert.equal(result.noteCalls.length, 300);
  assert.ok(result.doc.getNumberOfPages() > 6);
  notesStayInsidePage(result);
});

test('a 600-character unbroken note wraps without losing characters or crossing the footer', async () => {
  const notes = 'W'.repeat(600);
  const result = await prepare(notes);
  assert.equal(result.noteCalls.map(call => call.text).join(''), notes);
  assert.ok(result.noteCalls.length > 1, 'A long word is wrapped using real jsPDF metrics');
  notesStayInsidePage(result);
});

test('normal 600-character prose wraps and survives the generated PDF', async () => {
  const notes = 'Where could I put a desk, and how would the living space feel? '.repeat(12).slice(0, 600);
  const result = await prepare(notes);
  const normalise = value => value.replace(/\s+/g, ' ').trim();
  assert.equal(normalise(result.noteCalls.map(call => call.text).join(' ')), normalise(notes));
  notesStayInsidePage(result);
  const bytes = new Uint8Array(result.doc.output('arraybuffer'));
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), '%PDF-', 'The real PDF serialises successfully');
});

test('blank notes show a useful prompt and markup remains inert PDF text', async () => {
  const empty = await prepare('   ');
  assert.equal(empty.doc.getNumberOfPages(), 5);
  assert.equal(empty.noteCalls.map(call => call.text).join(' '), 'What would make this space feel like home?');
  const notes = '<script>alert("hello")</script> & a room for a desk';
  const untrusted = await prepare(notes);
  assert.equal(untrusted.noteCalls.map(call => call.text).join(' '), notes);
  assert.ok(!untrusted.doc.output().includes('/JavaScript'), 'Notes do not become a PDF script action');
  notesStayInsidePage(untrusted);
});

test('empty selections and invalid finance assumptions fail before creating image work', async () => {
  let imageLoads = 0;
  const options = { model, jsPDF, async loadImage() { imageLoads++; throw new Error('Image work should not begin'); } };
  await assert.rejects(brochure.create({ units: [], assumptions: model.defaults }, options), /Select a home and valid assumptions/);
  await assert.rejects(brochure.create({ units, assumptions: { ...model.defaults, years: 0 } }, options), /Select a home and valid assumptions/);
  assert.equal(imageLoads, 0);
});

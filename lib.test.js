import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from './vendor/pdf-lib.esm.min.js';
import { parseRanges, merge, extract, rotate, chunks } from './lib.js';

async function makePdf(n, w = 300) {
  const d = await PDFDocument.create();
  for (let i = 0; i < n; i++) d.addPage([w + i, 400]);
  return d.save();
}

test('parseRanges handles lists, ranges, open ends and reverse', () => {
  assert.deepEqual(parseRanges('1-3, 5', 10), [0, 1, 2, 4]);
  assert.deepEqual(parseRanges('8-', 10), [7, 8, 9]);
  assert.deepEqual(parseRanges('-2', 10), [0, 1]);
  assert.deepEqual(parseRanges('3-1', 10), [2, 1, 0]);
  assert.deepEqual(parseRanges('all', 3), [0, 1, 2]);
  assert.deepEqual(parseRanges('last', 4), [3]);
});

test('parseRanges rejects out of range and junk', () => {
  assert.throws(() => parseRanges('0', 5));
  assert.throws(() => parseRanges('6', 5));
  assert.throws(() => parseRanges('a-b', 5));
  assert.throws(() => parseRanges('', 5));
});

test('chunks splits a page count into groups', () => {
  assert.deepEqual(chunks(7, 3), [[0, 1, 2], [3, 4, 5], [6]]);
});

test('merge concatenates PDFs in order', async () => {
  const out = await merge([{ kind: 'pdf', bytes: await makePdf(2, 100) }, { kind: 'pdf', bytes: await makePdf(3, 200) }]);
  const d = await PDFDocument.load(out);
  assert.equal(d.getPageCount(), 5);
  assert.equal(Math.round(d.getPage(2).getWidth()), 200);
});

test('extract keeps only chosen pages in chosen order', async () => {
  const out = await extract(await makePdf(5, 100), [4, 0]);
  const d = await PDFDocument.load(out);
  assert.equal(d.getPageCount(), 2);
  assert.equal(Math.round(d.getPage(0).getWidth()), 104);
});

test('rotate adds to existing rotation', async () => {
  const out = await rotate(await makePdf(2), [1], 90);
  const d = await PDFDocument.load(out);
  assert.equal(d.getPage(0).getRotation().angle, 0);
  assert.equal(d.getPage(1).getRotation().angle, 90);
});

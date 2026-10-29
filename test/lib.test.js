'use strict';
require('./helpers');
const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizePhone, formatPhone, waUrl } = require('../src/lib/phone');
const { toInt, clean, queryString } = require('../src/lib/text');
const { prix, km, depuis } = require('../src/lib/format');
const { html, raw } = require('../src/lib/html');
const { sniff } = require('../src/lib/images');
const { Router } = require('../src/lib/router');

test('numéros de téléphone', () => {
  assert.equal(normalizePhone('77 123 45 67'), '221771234567');
  assert.equal(normalizePhone('0771234567'), '221771234567');
  assert.equal(normalizePhone('+221 77 123 45 67'), '221771234567');
  assert.equal(normalizePhone('00221771234567'), '221771234567');
  assert.equal(normalizePhone('221771234567'), '221771234567');
  assert.equal(normalizePhone('+33 6 12 34 56 78'), '33612345678');
  assert.equal(normalizePhone('12'), null);
  assert.equal(normalizePhone('abc'), null);
  assert.equal(normalizePhone(''), null);
  assert.equal(formatPhone('221771234567'), '+221 77 123 45 67');
  assert.equal(formatPhone('33612345678'), '+33612345678');
  assert.equal(waUrl('221770000000', 'Bonjour à tous'), 'https://wa.me/221770000000?text=Bonjour%20%C3%A0%20tous');
});

test('nombres et textes', () => {
  assert.equal(toInt('1 500 000'), 1500000);
  assert.equal(toInt('1 500 000'), 1500000);
  assert.equal(toInt('abc'), null);
  assert.equal(toInt(''), null);
  assert.equal(toInt('-5'), null);
  assert.equal(toInt('9'.repeat(30)), Number.MAX_SAFE_INTEGER);
  assert.equal(clean('  a \n  b\t c ', 10), 'a b c');
  assert.equal(clean('abcdef', 3), 'abc');
  assert.equal(queryString({ a: 1, b: '', c: null, d: 'x y' }), '?a=1&d=x+y');
  assert.equal(queryString({ a: '' }), '');
});

test('formats', () => {
  assert.equal(prix(1250000), '1 250 000 FCFA');
  assert.equal(prix(0), '0 FCFA');
  assert.equal(km(18000), '18 000 km');
  const now = new Date();
  const sql = (ms) => new Date(now.getTime() - ms).toISOString().replace('T', ' ').slice(0, 19);
  assert.equal(depuis(sql(10_000)), "à l'instant");
  assert.equal(depuis(sql(10 * 60_000)), 'il y a 10 min');
  assert.equal(depuis(sql(5 * 3600_000)), 'il y a 5 h');
  assert.equal(depuis(sql(86400_000 + 60_000)), 'hier');
  assert.equal(depuis(sql(3 * 86400_000)), 'il y a 3 jours');
  assert.equal(depuis(sql(65 * 86400_000)), 'il y a 2 mois');
  assert.equal(depuis(null), '');
});

test('gabarits : les valeurs sont échappées', () => {
  const evil = '<script>alert(1)</script> "x" \'y\' & z';
  assert.equal(html`<p>${evil}</p>`.value, '<p>&lt;script&gt;alert(1)&lt;/script&gt; &quot;x&quot; &#39;y&#39; &amp; z</p>');
  assert.equal(html`<a title="${evil}">`.value.includes('<script>'), false);
  assert.equal(html`<ul>${['a', '<b>'].map((x) => html`<li>${x}</li>`)}</ul>`.value, '<ul><li>a</li><li>&lt;b&gt;</li></ul>');
  assert.equal(html`${raw('<b>ok</b>')}`.value, '<b>ok</b>');
  assert.equal(html`${null}${undefined}${false}${0}`.value, '0');
});

test('type réel des images', () => {
  assert.equal(sniff(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), 'jpg');
  assert.equal(sniff(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])), 'png');
  assert.equal(sniff(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1')), 'webp');
  assert.equal(sniff(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
  assert.equal(sniff(Buffer.from('GIF89a......')), null);
  assert.equal(sniff(Buffer.from('court')), null);
});

test('routeur', () => {
  const r = new Router();
  const h = () => {};
  r.get('/a/:id(\\d+)', h).post('/a/:id(\\d+)/:action', h).get('/x', h);
  assert.deepEqual(r.match('GET', '/a/12').params, { id: '12' });
  assert.equal(r.match('GET', '/a/abc').handler, undefined);
  assert.deepEqual(r.match('POST', '/a/3/delete').params, { id: '3', action: 'delete' });
  assert.deepEqual(r.match('POST', '/x').allowed, ['GET']);
  assert.ok(r.match('HEAD', '/x').handler);
  assert.equal(r.match('GET', '/nope').allowed.length, 0);
});

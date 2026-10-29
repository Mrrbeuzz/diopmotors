'use strict';
/**
 * Petit moteur de gabarits : html`<p>${valeur}</p>`.
 * Toute valeur insérée est échappée automatiquement (protection contre le XSS),
 * sauf si elle vient d'un autre html`...` ou de raw(...).
 */
class Safe {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ESC[c]);

function render(value) {
  if (value instanceof Safe) return value.value;
  if (Array.isArray(value)) return value.map(render).join('');
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  return esc(value);
}

function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += render(values[i]) + strings[i + 1];
  return new Safe(out);
}

/** À n'utiliser que pour du HTML que nous avons écrit nous-mêmes. */
const raw = (value) => new Safe(String(value));

module.exports = { html, raw, esc, Safe };

'use strict';
const config = require('../config');

const group = (n) => String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** 1250000 -> "1 250 000 FCFA" (espaces insécables). */
function prix(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${group(n)} ${config.currency}` : '';
}

/** 18000 -> "18 000 km". */
function km(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${group(n)} km` : '';
}

/** Date (ou texte "2026-10-28 12:00:00" en UTC) -> "il y a 3 jours". */
function depuis(value) {
  if (!value) return '';
  const t = value instanceof Date ? value.getTime() : Date.parse(String(value).replace(' ', 'T') + 'Z');
  if (Number.isNaN(t)) return '';
  const secs = (Date.now() - t) / 1000;
  if (secs < 3600) return secs < 120 ? "à l'instant" : `il y a ${Math.floor(secs / 60)} min`;
  if (secs < 86400) return `il y a ${Math.floor(secs / 3600)} h`;
  const days = Math.floor(secs / 86400);
  if (days < 30) return days === 1 ? 'hier' : `il y a ${days} jours`;
  return `il y a ${Math.floor(days / 30)} mois`;
}

const kindLabel = (kind) => config.listingKinds[kind] || kind;

module.exports = { prix, km, depuis, kindLabel };

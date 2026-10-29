'use strict';

/** Texte sur une ligne : espaces normalisés, longueur limitée. */
const clean = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Texte multi-lignes : retours à la ligne gardés, longueur limitée. */
const cleanText = (value, max) => String(value ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);

/** Entier lisible depuis "1 500 000" ou "1500000". Renvoie null si ce n'est pas un nombre. */
function toInt(value) {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/[\s  .,]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  return digits.length > 15 ? Number.MAX_SAFE_INTEGER : parseInt(digits, 10);
}

/** Échappe % et _ pour un LIKE ... ESCAPE '\'. */
const likeEscape = (text) => text.replace(/[\\%_]/g, (m) => '\\' + m);

/** Chaîne de requête sans les valeurs vides : { a: 1, b: '' } -> "a=1". */
function queryString(params) {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== '' && value !== null && value !== undefined) usp.set(key, String(value));
  }
  const s = usp.toString();
  return s ? '?' + s : '';
}

module.exports = { clean, cleanText, toInt, likeEscape, queryString };

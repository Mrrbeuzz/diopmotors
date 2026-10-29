'use strict';
const config = require('../config');

/** Renvoie le numéro en chiffres, au format international, ou null s'il est invalide. */
function normalizePhone(raw) {
  const text = String(raw ?? '').trim();
  let digits = text.replace(/\D/g, '');
  if (!digits) return null;
  const cc = config.defaultCountryCode;
  if (text.startsWith('+')) {
    // déjà international
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
  } else if (digits.startsWith(cc) && digits.length >= cc.length + 8) {
    // indicatif déjà présent
  } else {
    digits = cc + digits.replace(/^0+/, '');
  }
  if (digits.length < 9 || digits.length > 15) return null;
  return digits;
}

/** 221771234567 -> "+221 77 123 45 67". */
function formatPhone(digits) {
  const cc = config.defaultCountryCode;
  if (digits && digits.startsWith(cc) && digits.length === cc.length + 9) {
    const n = digits.slice(cc.length);
    return `+${cc} ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5, 7)} ${n.slice(7)}`;
  }
  return '+' + (digits || '');
}

/** Lien WhatsApp avec message prérempli. */
function waUrl(phone, text = '') {
  return `https://wa.me/${phone}` + (text ? '?text=' + encodeURIComponent(text) : '');
}

module.exports = { normalizePhone, formatPhone, waUrl };

'use strict';
/**
 * Session dans un cookie signé (HMAC-SHA256). Rien n'est stocké sur le serveur.
 * Le cookie est HttpOnly, SameSite=Lax, et Secure en HTTPS.
 */
const crypto = require('node:crypto');
const config = require('../config');

const COOKIE = 'dm_session';
const MAX_AGE = 8 * 3600; // 8 heures

const hmac = (body) => crypto.createHmac('sha256', config.secretKey).update(body).digest('base64url');

function encode(data) {
  const body = Buffer.from(JSON.stringify({ d: data, exp: Math.floor(Date.now() / 1000) + MAX_AGE })).toString('base64url');
  return `${body}.${hmac(body)}`;
}

function decode(token) {
  if (!token) return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const expected = Buffer.from(hmac(body));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed.exp !== 'number' || parsed.exp < Date.now() / 1000) return null;
    return parsed.d && typeof parsed.d === 'object' ? parsed.d : null;
  } catch {
    return null;
  }
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

class Session {
  constructor(req) {
    this.data = decode(parseCookies(req.headers.cookie)[COOKIE]) || {};
    this.dirty = false;
  }

  get(key) { return this.data[key]; }

  set(key, value) { this.data[key] = value; this.dirty = true; }

  delete(key) { if (key in this.data) { delete this.data[key]; this.dirty = true; } }

  /** Repart d'une session vide (à la connexion et à la déconnexion). */
  reset() { this.data = {}; this.dirty = true; }

  /** Jeton CSRF de la session, créé au besoin. */
  csrf() {
    if (!this.data.csrf) this.set('csrf', crypto.randomBytes(24).toString('base64url'));
    return this.data.csrf;
  }

  /** Messages à afficher une fois (« Annonce validée », etc.). */
  flash(category, message) {
    const list = Array.isArray(this.data.flash) ? this.data.flash : [];
    list.push({ category, message });
    this.set('flash', list.slice(-5));
  }

  takeFlashes() {
    const list = Array.isArray(this.data.flash) ? this.data.flash : [];
    if (list.length) this.delete('flash');
    return list;
  }

  /** En-tête Set-Cookie si la session a changé, sinon null. */
  cookieHeader() {
    if (!this.dirty) return null;
    const attrs = [`${COOKIE}=${encode(this.data)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${MAX_AGE}`];
    if (config.https) attrs.push('Secure');
    return attrs.join('; ');
  }
}

module.exports = { Session };

'use strict';
const crypto = require('node:crypto');
const config = require('../config');

/** En-têtes de sécurité ajoutés à toutes les réponses. */
function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "style-src 'self' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    "script-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self' https://wa.me",
    "base-uri 'self'",
  ].join('; '));
  if (config.https) res.setHeader('Strict-Transport-Security', 'max-age=15552000');
}

/** Limiteur de débit en mémoire (une fenêtre glissante par clé). */
class RateLimiter {
  constructor() {
    this.hits = new Map();
    this.timer = setInterval(() => this.prune(), 5 * 60 * 1000);
    this.timer.unref();
  }

  recent(key, windowMs) {
    const now = Date.now();
    const list = (this.hits.get(key) || []).filter((t) => now - t < windowMs);
    this.hits.set(key, list);
    return list;
  }

  /** Vrai si la clé a encore le droit d'agir (sans compter l'action). */
  allowed(key, max, windowMs) { return this.recent(key, windowMs).length < max; }

  record(key, windowMs = 3600_000) {
    this.recent(key, windowMs).push(Date.now());
  }

  prune() {
    const now = Date.now();
    for (const [key, list] of this.hits) {
      if (!list.length || now - list[list.length - 1] > 3600_000) this.hits.delete(key);
    }
  }

  clear() { this.hits.clear(); }
}

/** Comparaison de mots de passe sans fuite sur la longueur ni le temps. */
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

module.exports = { applySecurityHeaders, RateLimiter, safeEqual };

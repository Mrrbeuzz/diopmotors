'use strict';
/** Outils HTTP : contexte de requête, lecture des formulaires, fichiers statiques. */
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');
const { Session } = require('./session');
const { Safe } = require('./html');

class HttpError extends Error {
  constructor(status, message) {
    super(message || String(status));
    this.status = status;
  }
}

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

function clientIp(req) {
  if (config.trustProxy) {
    const cf = req.headers['cf-connecting-ip'];
    if (cf) return String(cf);
    const xff = req.headers['x-forwarded-for'];
    if (xff) return String(xff).split(',')[0].trim();
  }
  return req.socket.remoteAddress || '?';
}

/** Valeurs d'un formulaire (champs texte et fichiers). */
class Form {
  constructor(formData) { this.fd = formData; }

  get(name) {
    const value = this.fd.get(name);
    return typeof value === 'string' ? value : '';
  }

  /** Fichiers envoyés pour un champ (les champs de fichier laissés vides sont ignorés). */
  files(name) {
    return this.fd.getAll(name).filter((f) => typeof f !== 'string' && f.size > 0 && f.name);
  }
}

async function readBody(req, maxBytes) {
  const declared = parseInt(req.headers['content-length'] || '0', 10);
  if (declared > maxBytes) throw new HttpError(413, 'too large');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new HttpError(413, 'too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function parseForm(req) {
  const type = String(req.headers['content-type'] || '');
  const isMultipart = /^multipart\/form-data/i.test(type);
  const isUrlEncoded = /^application\/x-www-form-urlencoded/i.test(type);
  if (!isMultipart && !isUrlEncoded) throw new HttpError(415, 'unsupported content type');
  const max = (isMultipart ? config.maxUploadMb : 1) * 1024 * 1024;
  const body = await readBody(req, max);
  try {
    const request = new Request('http://localhost/', { method: 'POST', headers: { 'content-type': type }, body });
    return new Form(await request.formData());
  } catch {
    throw new HttpError(400, 'bad form');
  }
}

function safeDecode(text) {
  try { return decodeURIComponent(text); } catch { throw new HttpError(400, 'bad path'); }
}

class Context {
  constructor(req, res) {
    this.req = req;
    this.res = res;
    this.method = req.method;
    const raw = req.url || '/';
    const qi = raw.indexOf('?');
    const pathname = safeDecode(qi < 0 ? raw : raw.slice(0, qi));
    if (!pathname.startsWith('/')) throw new HttpError(400, 'bad path');
    this.path = pathname.length > 1 ? pathname.replace(/\/+$/, '') || '/' : pathname;
    this.query = new URLSearchParams(qi < 0 ? '' : raw.slice(qi + 1));
    this.params = {};
    this.ip = clientIp(req);
    this.session = new Session(req);
    this._form = null;
  }

  /** Paramètre de l'adresse (?nom=valeur), texte vide s'il est absent. */
  q(name) { return this.query.get(name) || ''; }

  async form() {
    if (!this._form) this._form = await parseForm(this.req);
    return this._form;
  }

  send(status, body, headers = {}) {
    const cookie = this.session.cookieHeader();
    if (cookie) this.res.setHeader('Set-Cookie', cookie);
    const buf = Buffer.from(body);
    this.res.writeHead(status, { 'Content-Length': buf.length, 'Cache-Control': 'no-store', ...headers });
    this.res.end(this.method === 'HEAD' ? undefined : buf);
  }

  html(view, status = 200) {
    const body = view instanceof Safe ? view.value : String(view);
    this.send(status, '<!doctype html>\n' + body, { 'Content-Type': 'text/html; charset=utf-8' });
  }

  json(data, status = 200, headers = {}) {
    this.send(status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  }

  redirect(location, status = 303) {
    this.send(status, '', { Location: location });
  }
}

/** Envoie un fichier d'un dossier, sans jamais en sortir. */
async function serveFile(ctx, baseDir, rel, { maxAge = 3600 } = {}) {
  if (rel.includes('\0')) throw new HttpError(404);
  const base = path.resolve(baseDir);
  const full = path.resolve(base, '.' + path.sep + rel);
  if (!full.startsWith(base + path.sep)) throw new HttpError(404);
  const type = MIME[path.extname(full).toLowerCase()];
  if (!type) throw new HttpError(404);
  let st;
  try { st = await fs.promises.stat(full); } catch { throw new HttpError(404); }
  if (!st.isFile()) throw new HttpError(404);

  const etag = `W/"${st.size}-${Math.floor(st.mtimeMs)}"`;
  const headers = {
    'Content-Type': type,
    'Content-Length': st.size,
    'Cache-Control': `public, max-age=${maxAge}`,
    ETag: etag,
  };
  if (ctx.req.headers['if-none-match'] === etag) {
    ctx.res.writeHead(304, { ETag: etag, 'Cache-Control': headers['Cache-Control'] });
    ctx.res.end();
    return;
  }
  ctx.res.writeHead(200, headers);
  if (ctx.method === 'HEAD') { ctx.res.end(); return; }
  fs.createReadStream(full).on('error', () => ctx.res.destroy()).pipe(ctx.res);
}

module.exports = { HttpError, Context, Form, serveFile, clientIp };

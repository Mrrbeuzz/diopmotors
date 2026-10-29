'use strict';
/**
 * Outils de test : dossier de données temporaire, serveur sur un port libre et client
 * HTTP avec cookies. À charger avant tout autre module du site.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diopmotors-test-'));
process.env.DATA_DIR = dataDir;
// Chaque fichier de test travaille dans son propre schéma PostgreSQL, supprimé à la fin :
// vos vraies données ne sont jamais touchées.
const schema = `test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
process.env.DATABASE_SCHEMA = schema;
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.ADMIN_PASSWORD = 'test-password';
process.env.WHATSAPP_NUMBER = '221770000000';
process.env.DEFAULT_COUNTRY_CODE = '221';
process.env.CURRENCY = 'FCFA';
process.env.SECRET_KEY = 'secret-de-test';
process.env.HTTPS = '0';
process.env.TRUST_PROXY = '0';

const root = path.resolve(__dirname, '..');

/** Données de démonstration (10 produits, 7 annonces dont 1 en attente). */
function seed() {
  execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(root, 'scripts', 'seed-demo.js')], {
    env: process.env, stdio: 'ignore',
  });
}

class Client {
  constructor(base) { this.base = base; this.jar = new Map(); this.token = null; }

  async req(method, url, { body, headers = {} } = {}) {
    const cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(this.base + url, {
      method, body, redirect: 'manual', headers: { ...(cookie ? { cookie } : {}), ...headers },
    });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      this.jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    const text = await res.text();
    return { status: res.status, headers: res.headers, text, json: () => JSON.parse(text) };
  }

  get(url) { return this.req('GET', url); }

  async csrf() {
    if (!this.token) {
      const r = await this.get('/annonces/deposer');
      this.token = /name="_csrf" value="([^"]+)"/.exec(r.text)[1];
    }
    return this.token;
  }

  /** POST multipart avec jeton CSRF. `files` : { champ: { data, name, type } ou liste }. */
  async post(url, fields = {}, files = {}, { csrf = true } = {}) {
    const fd = new FormData();
    if (csrf) fd.append('_csrf', await this.csrf());
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    for (const [k, list] of Object.entries(files)) {
      for (const f of [].concat(list)) fd.append(k, new Blob([f.data], { type: f.type || 'image/jpeg' }), f.name);
    }
    return this.req('POST', url, { body: fd });
  }
}

async function start() {
  seed(); // crée le schéma, les tables et les données de démonstration
  const db = require('../src/db');
  const { createServer, limiter } = require('../src/app');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  /** Arrête le serveur et supprime le schéma de test. */
  async function stop() {
    server.close();
    server.closeAllConnections();
    await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await db.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  return { base, server, limiter, stop, client: () => new Client(base), dataDir };
}

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name));

/** Interroge la base pour vérifier ce qui y est enregistré. Écrivez « ? » pour les valeurs. */
async function query(sql, ...params) {
  let n = 0;
  return require('../src/db').all(sql.replace(/\?/g, () => `$${++n}`), params);
}

module.exports = { start, fixture, query, dataDir, schema };

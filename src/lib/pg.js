'use strict';
/**
 * Petit client PostgreSQL, sans dépendance (protocole natif, version 3).
 *
 *   const pool = new Pool('postgres://utilisateur:motdepasse@127.0.0.1:5432/base?sslmode=require');
 *   const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [3]);
 *   await pool.transaction(async (tx) => { await tx.query('...'); });
 *
 * Gère : authentification SCRAM-SHA-256 (défaut de PostgreSQL 14+), MD5 et mot de passe
 * en clair, TLS (sslmode=require / verify-full), requêtes paramétrées ($1, $2...),
 * transactions et un pool de connexions.
 *
 * Conversion des types : entiers (dont bigint) -> number, boolean -> boolean,
 * timestamp / timestamptz -> Date, json / jsonb -> objet, le reste -> texte.
 */
const net = require('node:net');
const tls = require('node:tls');
const crypto = require('node:crypto');

class PgError extends Error {
  constructor(fields) {
    super(fields.M || 'Erreur PostgreSQL');
    this.name = 'PgError';
    this.code = fields.C;        // code SQLSTATE, par exemple 23505 = doublon
    this.detail = fields.D;
    this.constraint = fields.n;
    this.severity = fields.S;
  }
}

// ---- Écriture des messages -------------------------------------------------

const cstr = (s) => Buffer.concat([Buffer.from(s, 'utf8'), Buffer.from([0])]);
const i16 = (n) => { const b = Buffer.allocUnsafe(2); b.writeInt16BE(n); return b; };
const i32 = (n) => { const b = Buffer.allocUnsafe(4); b.writeInt32BE(n); return b; };

function message(type, ...parts) {
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from(type, 'latin1'), i32(body.length + 4), body]);
}

/** Valeur JavaScript -> texte envoyé à PostgreSQL (null reste null). */
function encodeParam(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v.replace(/\0/g, ''); // PostgreSQL refuse le caractère nul
  if (typeof v === 'boolean') return v ? 't' : 'f';
  if (typeof v === 'number' || typeof v === 'bigint') return String(v);
  if (v instanceof Date) return v.toISOString();
  if (Buffer.isBuffer(v)) return '\\x' + v.toString('hex');
  return JSON.stringify(v);
}

// ---- Lecture des valeurs ---------------------------------------------------

function parseTimestamp(text, withZone) {
  if (text === 'infinity' || text === '-infinity') return null;
  let iso = text.replace(' ', 'T');
  if (withZone) iso = iso.replace(/([+-]\d\d)$/, '$1:00'); // "+00" -> "+00:00"
  else iso += 'Z';                                         // sans fuseau : on suppose UTC
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? text : d;
}

const PARSERS = {
  16: (t) => t === 't',
  20: Number, 21: Number, 23: Number, 26: Number, 700: Number, 701: Number, 1700: Number,
  114: JSON.parse, 3802: JSON.parse,
  1114: (t) => parseTimestamp(t, false),
  1184: (t) => parseTimestamp(t, true),
};

// ---- Connexion -------------------------------------------------------------

function parseUrl(url) {
  const u = new URL(url);
  if (u.protocol !== 'postgres:' && u.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL doit commencer par postgres:// ou postgresql://');
  }
  return {
    host: u.hostname || '127.0.0.1',
    port: Number(u.port) || 5432,
    user: decodeURIComponent(u.username || 'postgres'),
    password: decodeURIComponent(u.password || ''),
    database: decodeURIComponent(u.pathname.replace(/^\//, '')) || undefined,
    sslmode: u.searchParams.get('sslmode') || 'disable',
    schema: u.searchParams.get('schema') || '',
  };
}

const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
const sha256 = (data) => crypto.createHash('sha256').update(data).digest();
const pbkdf2 = (password, salt, iterations) => new Promise((resolve, reject) => {
  crypto.pbkdf2(password, salt, iterations, 32, 'sha256', (err, key) => (err ? reject(err) : resolve(key)));
});

class Connection {
  constructor(options) {
    this.options = options;
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.dead = false;
    this.current = null;     // requête en cours : { resolve, reject, ... }
    this.waiting = null;     // fonction appelée à chaque message pendant la connexion
    this.inTransaction = false;
  }

  // -- Établissement --

  async connect() {
    const o = this.options;
    const socket = await new Promise((resolve, reject) => {
      const s = net.connect({ host: o.host, port: o.port });
      const timer = setTimeout(() => { s.destroy(); reject(new Error(`Connexion à PostgreSQL impossible (délai dépassé) : ${o.host}:${o.port}`)); }, o.connectTimeout);
      s.once('connect', () => { clearTimeout(timer); resolve(s); });
      s.once('error', (err) => { clearTimeout(timer); reject(err); });
    });
    socket.setNoDelay(true);
    this.socket = await this.maybeUpgradeToTls(socket);
    this.socket.on('data', (chunk) => this.onData(chunk));
    this.socket.on('error', (err) => this.fail(err));
    this.socket.on('close', () => this.fail(new Error('Connexion PostgreSQL fermée')));
    await this.startup();
  }

  async maybeUpgradeToTls(socket) {
    const mode = this.options.sslmode;
    if (!['require', 'verify-ca', 'verify-full', 'prefer'].includes(mode)) return socket;
    socket.write(Buffer.concat([i32(8), i32(80877103)])); // SSLRequest
    const answer = await new Promise((resolve, reject) => {
      socket.once('data', resolve);
      socket.once('error', reject);
    });
    if (answer.toString('latin1')[0] !== 'S') {
      if (mode === 'prefer') return socket;
      throw new Error("Le serveur PostgreSQL n'accepte pas le chiffrement TLS (sslmode=require).");
    }
    return tls.connect({
      socket,
      servername: net.isIP(this.options.host) ? undefined : this.options.host,
      rejectUnauthorized: mode === 'verify-full' || mode === 'verify-ca',
    });
  }

  async startup() {
    const o = this.options;
    const params = [['user', o.user], ['client_encoding', 'UTF8'], ['application_name', 'diopmotors'],
      ['statement_timeout', String(o.statementTimeout)]];
    if (o.database) params.push(['database', o.database]);
    if (o.schema) params.push(['options', `-c search_path=${o.schema}`]);
    const body = Buffer.concat([i32(196608), ...params.flatMap(([k, v]) => [cstr(k), cstr(v)]), Buffer.from([0])]);
    this.socket.write(Buffer.concat([i32(body.length + 4), body]));

    await new Promise((resolve, reject) => {
      let scram = null;
      this.waiting = async (type, payload) => {
        try {
          if (type === 'E') throw new PgError(parseFields(payload));
          if (type === 'Z') { this.waiting = null; resolve(); return; }
          if (type !== 'R') return;
          const code = payload.readInt32BE(0);
          if (code === 0) return;                                        // authentification réussie
          if (code === 3) return this.socket.write(message('p', cstr(o.password)));
          if (code === 5) {
            const md5 = (d) => crypto.createHash('md5').update(d).digest('hex');
            const hash = 'md5' + md5(Buffer.concat([Buffer.from(md5(o.password + o.user)), payload.subarray(4, 8)]));
            return this.socket.write(message('p', cstr(hash)));
          }
          if (code === 10) {                                             // SCRAM : début
            const mechanisms = payload.subarray(4).toString('latin1').split('\0');
            if (!mechanisms.includes('SCRAM-SHA-256')) throw new Error('Méthode de connexion PostgreSQL non prise en charge.');
            scram = { nonce: crypto.randomBytes(18).toString('base64') };
            scram.firstBare = `n=,r=${scram.nonce}`;
            const first = Buffer.from(`n,,${scram.firstBare}`);
            return this.socket.write(message('p', cstr('SCRAM-SHA-256'), i32(first.length), first));
          }
          if (code === 11) {                                             // SCRAM : réponse du serveur
            const serverFirst = payload.subarray(4).toString('utf8');
            const f = Object.fromEntries(serverFirst.split(',').map((p) => [p[0], p.slice(2)]));
            if (!f.r.startsWith(scram.nonce)) throw new Error('Réponse SCRAM invalide.');
            const salted = await pbkdf2(Buffer.from(o.password, 'utf8'), Buffer.from(f.s, 'base64'), Number(f.i));
            const clientKey = hmac(salted, 'Client Key');
            const withoutProof = `c=biws,r=${f.r}`;
            scram.authMessage = `${scram.firstBare},${serverFirst},${withoutProof}`;
            const signature = hmac(sha256(clientKey), scram.authMessage);
            const proof = Buffer.from(clientKey.map((b, i) => b ^ signature[i])).toString('base64');
            scram.serverSignature = hmac(hmac(salted, 'Server Key'), scram.authMessage).toString('base64');
            return this.socket.write(message('p', Buffer.from(`${withoutProof},p=${proof}`)));
          }
          if (code === 12) {                                             // SCRAM : vérification du serveur
            const v = payload.subarray(4).toString('utf8').replace(/^v=/, '');
            if (v !== scram.serverSignature) throw new Error("Le serveur PostgreSQL n'a pas prouvé son identité.");
            return;
          }
          throw new Error(`Méthode d'authentification PostgreSQL inconnue (${code}).`);
        } catch (err) {
          this.waiting = null;
          reject(err);
        }
      };
    });
  }

  // -- Réception --

  onData(chunk) {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
    while (this.buffer.length >= 5) {
      const len = this.buffer.readInt32BE(1);
      if (this.buffer.length < len + 1) break;
      const type = String.fromCharCode(this.buffer[0]);
      const payload = this.buffer.subarray(5, len + 1);
      this.buffer = this.buffer.subarray(len + 1);
      if (this.waiting) this.waiting(type, payload);
      else this.onMessage(type, payload);
    }
  }

  onMessage(type, payload) {
    const q = this.current;
    if (!q) return; // notices, paramètres : ignorés
    switch (type) {
      case 'T': { // description des colonnes
        let pos = 2;
        q.fields = [];
        for (let i = 0; i < payload.readInt16BE(0); i++) {
          const end = payload.indexOf(0, pos);
          const name = payload.toString('utf8', pos, end);
          const oid = payload.readInt32BE(end + 1 + 6);
          q.fields.push({ name, parse: PARSERS[oid] });
          pos = end + 1 + 18;
        }
        break;
      }
      case 'D': { // une ligne
        let pos = 2;
        const row = {};
        for (let i = 0; i < q.fields.length; i++) {
          const len = payload.readInt32BE(pos);
          pos += 4;
          if (len === -1) { row[q.fields[i].name] = null; continue; }
          const text = payload.toString('utf8', pos, pos + len);
          pos += len;
          const parse = q.fields[i].parse;
          row[q.fields[i].name] = parse ? parse(text) : text;
        }
        q.rows.push(row);
        break;
      }
      case 'C': { // fin d'une commande : « INSERT 0 1 », « UPDATE 3 »...
        const tag = payload.toString('utf8', 0, payload.length - 1);
        const n = Number(tag.split(' ').pop());
        q.rowCount = Number.isFinite(n) ? n : q.rows.length;
        break;
      }
      case 'E':
        q.error = new PgError(parseFields(payload));
        break;
      case 'Z': { // prêt pour la requête suivante
        this.current = null;
        if (q.error) q.reject(q.error); else q.resolve({ rows: q.rows, rowCount: q.rowCount ?? q.rows.length });
        break;
      }
      default:
    }
  }

  fail(err) {
    if (this.dead) return;
    this.dead = true;
    const pending = this.current;
    this.current = null;
    if (this.waiting) { const w = this.waiting; this.waiting = null; w('E', Buffer.from(`M${err.message}\0\0`)); }
    if (pending) pending.reject(err);
    this.socket?.destroy();
    this.onDead?.(this);
  }

  // -- Requêtes --

  send(buffers) {
    return new Promise((resolve, reject) => {
      if (this.dead) return reject(new Error('Connexion PostgreSQL fermée'));
      this.current = { resolve, reject, rows: [], fields: [], rowCount: undefined, error: null };
      this.socket.write(Buffer.concat(buffers));
    });
  }

  /** Requête avec paramètres ($1, $2...). Une seule commande SQL. */
  query(text, params = []) {
    const values = params.map((p) => {
      const v = encodeParam(p);
      return v === null ? i32(-1) : Buffer.concat([i32(Buffer.byteLength(v)), Buffer.from(v, 'utf8')]);
    });
    return this.send([
      message('P', cstr(''), cstr(text), i16(0)),
      message('B', cstr(''), cstr(''), i16(0), i16(values.length), ...values, i16(0)),
      message('D', Buffer.from('P'), cstr('')),
      message('E', cstr(''), i32(0)),
      message('S'),
    ]);
  }

  /** Une ou plusieurs commandes sans paramètre (création des tables, BEGIN, COMMIT). */
  simple(text) {
    return this.send([message('Q', cstr(text))]);
  }

  close() {
    if (this.dead) return;
    try { this.socket.write(message('X')); } catch { /* déjà fermée */ }
    this.dead = true;
    this.socket.end();
  }
}

function parseFields(payload) {
  const fields = {};
  let pos = 0;
  while (pos < payload.length && payload[pos] !== 0) {
    const code = String.fromCharCode(payload[pos]);
    const end = payload.indexOf(0, pos + 1);
    fields[code] = payload.toString('utf8', pos + 1, end);
    pos = end + 1;
  }
  return fields;
}

// ---- Pool ------------------------------------------------------------------

class Pool {
  constructor(url, { max = 10, schema = '', idleMs = 30_000, connectTimeout = 10_000, statementTimeout = 20_000 } = {}) {
    const parsed = parseUrl(url);
    this.options = { ...parsed, schema: schema || parsed.schema, connectTimeout, statementTimeout };
    this.max = max;
    this.idleMs = idleMs;
    this.idle = [];
    this.size = 0;
    this.queue = [];
    this.closed = false;
  }

  async acquire() {
    if (this.closed) throw new Error('La connexion à la base est fermée.');
    while (this.idle.length) {
      const conn = this.idle.pop();
      clearTimeout(conn.idleTimer);
      if (!conn.dead) return conn;
    }
    if (this.size < this.max) {
      this.size++;
      const conn = new Connection(this.options);
      conn.onDead = () => { this.size--; this.pump(); };
      try {
        await conn.connect();
      } catch (err) {
        if (!conn.dead) { // sinon, onDead a déjà libéré la place
          conn.dead = true;
          conn.socket?.destroy();
          this.size--;
          this.pump();
        }
        throw err;
      }
      return conn;
    }
    return new Promise((resolve, reject) => { this.queue.push({ resolve, reject }); });
  }

  /** Quand une place se libère, sert la file d'attente. */
  pump() {
    while (this.queue.length && this.idle.length + (this.max - this.size) > 0) {
      const waiter = this.queue.shift();
      this.acquire().then(waiter.resolve, waiter.reject);
    }
  }

  release(conn) {
    if (conn.dead) return;
    if (this.closed) { conn.close(); return; }
    if (this.queue.length) { this.queue.shift().resolve(conn); return; }
    conn.idleTimer = setTimeout(() => { // ferme les connexions inutilisées
      this.idle = this.idle.filter((c) => c !== conn);
      conn.close();
      this.size--;
    }, this.idleMs);
    conn.idleTimer.unref();
    this.idle.push(conn);
  }

  async query(text, params) {
    const conn = await this.acquire();
    try {
      return await conn.query(text, params);
    } finally {
      this.release(conn);
    }
  }

  async simple(text) {
    const conn = await this.acquire();
    try {
      return await conn.simple(text);
    } finally {
      this.release(conn);
    }
  }

  /** Exécute `fn(tx)` dans une transaction : annulée si `fn` lève une erreur. */
  async transaction(fn) {
    const conn = await this.acquire();
    try {
      await conn.simple('BEGIN');
      let result;
      try {
        result = await fn({ query: (t, p) => conn.query(t, p), simple: (t) => conn.simple(t) });
      } catch (err) {
        if (!conn.dead) await conn.simple('ROLLBACK').catch(() => {});
        throw err;
      }
      await conn.simple('COMMIT');
      return result;
    } finally {
      this.release(conn);
    }
  }

  async end() {
    this.closed = true;
    for (const w of this.queue.splice(0)) w.reject(new Error('La connexion à la base est fermée.'));
    for (const conn of this.idle.splice(0)) { clearTimeout(conn.idleTimer); conn.close(); }
  }
}

module.exports = { Pool, PgError, parseUrl };

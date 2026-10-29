'use strict';
/**
 * Accès à la base PostgreSQL.
 *
 *   await db.all('SELECT * FROM products WHERE price < $1', [5000])   -> tableau de lignes
 *   await db.one('SELECT * FROM products WHERE id = $1', [3])         -> une ligne ou undefined
 *   await db.run('DELETE FROM products WHERE id = $1', [3])           -> nombre de lignes touchées
 *   await db.transaction(async (tx) => { await tx.query('...', [...]); })
 */
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config');
const { Pool } = require('./lib/pg');

fs.mkdirSync(config.uploadDir, { recursive: true });

const pool = new Pool(config.databaseUrl, { max: config.dbPoolSize, schema: config.databaseSchema });

const query = (text, params) => pool.query(text, params);
const all = async (text, params) => (await pool.query(text, params)).rows;
const one = async (text, params) => (await pool.query(text, params)).rows[0];
const run = async (text, params) => (await pool.query(text, params)).rowCount;
const transaction = (fn) => pool.transaction(fn);

/** Un identifiant que PostgreSQL accepte (entier de 1 à 2 147 483 647). */
const validId = (id) => Number.isInteger(id) && id > 0 && id <= 2147483647;

/** Petit outil pour écrire des requêtes dynamiques : add(valeur) renvoie « $n ». */
function params() {
  const values = [];
  const add = (v) => { values.push(v); return `$${values.length}`; };
  return { values, add };
}

/** Crée les tables si elles n'existent pas (sans rien effacer). */
async function init() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.transaction(async (tx) => {
    // Verrou : deux démarrages en même temps n'entrent pas en conflit.
    await tx.query('SELECT pg_advisory_xact_lock(727274)');
    if (config.databaseSchema) await tx.simple(`CREATE SCHEMA IF NOT EXISTS "${config.databaseSchema.replace(/"/g, '')}"`);
    await tx.simple(sql);
  });
}

const close = () => pool.end();

module.exports = { query, all, one, run, transaction, params, validId, init, close, pool };

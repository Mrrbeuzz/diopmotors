'use strict';
/**
 * Réglages du site Diop Motors.
 * Les valeurs se changent ici ou, mieux, dans le fichier `.env` (voir .env.example).
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');

/** Lit un fichier .env simple (CLE=valeur, une par ligne). */
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let value = t.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnv(path.join(ROOT, '.env'));

const env = (key, fallback) => (process.env[key] !== undefined && process.env[key] !== '' ? process.env[key] : fallback);

const dataDir = path.resolve(env('DATA_DIR', path.join(ROOT, 'data')));
fs.mkdirSync(dataDir, { recursive: true });

function loadSecret() {
  if (env('SECRET_KEY')) return env('SECRET_KEY');
  const file = path.join(dataDir, 'secret_key');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const key = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(file, key, { mode: 0o600 });
  return key;
}

module.exports = Object.freeze({
  root: ROOT,
  siteName: 'Diop Motors',

  // Numéro WhatsApp qui reçoit les commandes, format international sans "+".
  whatsappNumber: env('WHATSAPP_NUMBER', '221770000000'),
  defaultCountryCode: env('DEFAULT_COUNTRY_CODE', '221'),
  currency: env('CURRENCY', 'FCFA'),

  adminPassword: env('ADMIN_PASSWORD', 'changeme'),
  secretKey: loadSecret(),
  https: env('HTTPS', '0') === '1',
  // À activer derrière Nginx ou Cloudflare, pour lire la vraie adresse IP du visiteur.
  trustProxy: env('TRUST_PROXY', '0') === '1',

  host: env('HOST', '127.0.0.1'),
  port: parseInt(env('PORT', '3000'), 10),

  // Base PostgreSQL : postgres://utilisateur:motdepasse@serveur:5432/base  (ajoutez ?sslmode=require si le serveur l'exige)
  databaseUrl: env('DATABASE_URL', 'postgres://diop:diop@127.0.0.1:5432/diopmotors'),
  databaseSchema: env('DATABASE_SCHEMA', ''),   // facultatif : isole les tables dans un schéma (utilisé par les tests)
  dbPoolSize: parseInt(env('DATABASE_POOL', '10'), 10),

  dataDir,
  uploadDir: path.join(dataDir, 'uploads'),
  publicDir: path.join(ROOT, 'public'),

  productCategories: [
    'Huiles et lubrifiants',
    'Kits chaîne',
    'Moteur et pièces',
    'Freinage',
    'Batteries et électricité',
    'Pneus et roues',
    'Accessoires',
    'Équipement du motard',
  ],

  listingKinds: { moto: 'Moto', scooter: 'Scooter' },
  maxPhotos: 6,
  maxPendingPerPhone: 5,   // anti-spam : annonces en attente par numéro
  maxFileMb: 6,            // poids maximum d'une photo
  maxUploadMb: 40,         // poids total maximum d'un formulaire avec photos
  perPageProducts: 24,
  perPageListings: 12,
});

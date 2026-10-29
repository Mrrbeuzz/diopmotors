'use strict';
/** Annonces de motos et scooters : requêtes, validation et statuts. */
const db = require('../db');
const config = require('../config');
const { clean, cleanText, toInt, likeEscape } = require('../lib/text');
const { normalizePhone } = require('../lib/phone');
const { removeUpload } = require('../lib/images');

const COVER = '(SELECT filename FROM listing_photos p WHERE p.listing_id = l.id ORDER BY p.position, p.id LIMIT 1)';

const SORTS = {
  recent: 'l.approved_at DESC NULLS LAST, l.id DESC',
  prix_asc: 'l.price ASC, l.id DESC',
  prix_desc: 'l.price DESC, l.id DESC',
  annee: 'l.year DESC, l.id DESC',
};

/** Annonces en ligne, avec filtres, tri et pagination. */
async function search({ kind = '', brand = '', q = '', maxPrice = null, sort = 'recent', page = 1 } = {}) {
  const { values, add } = db.params();
  const where = ["l.status = 'approved'"];
  if (config.listingKinds[kind]) {
    where.push(`l.kind = ${add(kind)}`);
  } else {
    kind = '';
  }
  if (brand) where.push(`lower(l.brand) = lower(${add(brand)})`);
  if (q) {
    const like = add(`%${likeEscape(q)}%`);
    where.push(`(l.title ILIKE ${like} ESCAPE '\\' OR l.city ILIKE ${like} ESCAPE '\\' OR l.description ILIKE ${like} ESCAPE '\\')`);
  }
  if (maxPrice) where.push(`l.price <= ${add(Math.min(maxPrice, 2_000_000_000))}`);
  if (!SORTS[sort]) sort = 'recent';

  const w = where.join(' AND ');
  const total = (await db.one(`SELECT COUNT(*) AS n FROM listings l WHERE ${w}`, values)).n;
  const per = config.perPageListings;
  const pages = Math.max(1, Math.ceil(total / per));
  const current = Math.min(Math.max(1, page), pages);
  const items = await db.all(
    `SELECT l.*, ${COVER} AS cover FROM listings l WHERE ${w} ORDER BY ${SORTS[sort]}
     LIMIT ${add(per)} OFFSET ${add((current - 1) * per)}`,
    values,
  );
  return { items, total, page: current, pages, kind, sort };
}

const latest = (n) => db.all(
  `SELECT l.*, ${COVER} AS cover FROM listings l WHERE l.status = 'approved'
   ORDER BY l.approved_at DESC NULLS LAST, l.id DESC LIMIT $1`, [n],
);

const get = async (id) => (db.validId(id) ? db.one('SELECT * FROM listings WHERE id = $1', [id]) : undefined);

const photos = (id) => db.all(
  'SELECT filename FROM listing_photos WHERE listing_id = $1 ORDER BY position, id', [id],
);

/** Marques présentes dans les annonces en ligne (sans doublon de casse). */
const brands = async () => (await db.all(
  "SELECT MIN(brand) AS brand FROM listings WHERE status = 'approved' GROUP BY lower(brand) ORDER BY lower(brand)",
)).map((r) => r.brand);

/** Vérifie les champs du formulaire d'annonce. */
function validate(raw) {
  const errors = [];
  const data = {
    kind: String(raw.kind || ''),
    brand: clean(raw.brand, 40),
    model: clean(raw.model, 60),
    year: toInt(raw.year),
    mileage: toInt(raw.mileage),
    price: toInt(raw.price),
    city: clean(raw.city, 60),
    description: cleanText(raw.description, 2000),
    sellerName: clean(raw.sellerName, 60),
    phone: normalizePhone(clean(raw.phone, 30)),
  };
  const thisYear = new Date().getFullYear();
  if (!config.listingKinds[data.kind]) errors.push('Choisissez moto ou scooter.');
  if (!data.brand) errors.push('Indiquez la marque.');
  if (!data.model) errors.push('Indiquez le modèle.');
  if (data.year === null || data.year < 1970 || data.year > thisYear + 1) errors.push('Indiquez une année valide.');
  if (data.mileage === null || data.mileage > 999999) errors.push('Indiquez le kilométrage (0 si le véhicule est neuf).');
  if (!data.price || data.price > 1_000_000_000) errors.push('Indiquez un prix valide.');
  if (!data.city) errors.push('Indiquez la ville ou le quartier.');
  if (data.description.length < 15) errors.push("Ajoutez une description d'au moins quelques mots (état, entretien, papiers).");
  if (!data.sellerName) errors.push('Indiquez votre nom.');
  if (!data.phone) errors.push("Le numéro de téléphone n'est pas valide.");
  if (!raw.consent) errors.push('Acceptez que votre numéro soit visible sur l\'annonce.');
  return { data, errors };
}

const pendingCountForPhone = async (phone) => (await db.one(
  "SELECT COUNT(*) AS n FROM listings WHERE seller_phone = $1 AND status = 'pending'", [phone],
)).n;

/** Crée une annonce « à valider » avec ses photos. Renvoie son identifiant. */
function create(data, filenames) {
  const brand = data.brand.charAt(0).toUpperCase() + data.brand.slice(1);
  const title = `${brand} ${data.model} ${data.year}`;
  return db.transaction(async (tx) => {
    const { rows } = await tx.query(
      `INSERT INTO listings (kind, title, brand, model, year, mileage, price, city, description, seller_name, seller_phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [data.kind, title, brand, data.model, data.year, data.mileage, data.price, data.city,
        data.description, data.sellerName, data.phone],
    );
    const id = rows[0].id;
    for (let i = 0; i < filenames.length; i++) {
      await tx.query('INSERT INTO listing_photos (listing_id, filename, position) VALUES ($1,$2,$3)', [id, filenames[i], i]);
    }
    return id;
  });
}

async function countsByStatus() {
  const out = {};
  for (const r of await db.all('SELECT status, COUNT(*) AS n FROM listings GROUP BY status')) out[r.status] = r.n;
  return out;
}

const listByStatus = (status) => db.all(
  `SELECT l.*, ${COVER} AS cover FROM listings l WHERE l.status = $1 ORDER BY l.created_at DESC, l.id DESC`, [status],
);

const SET_STATUS = {
  approve: ["UPDATE listings SET status = 'approved', approved_at = COALESCE(approved_at, now()) WHERE id = $1", (t) => `${t} est en ligne.`],
  reject: ["UPDATE listings SET status = 'rejected' WHERE id = $1", (t) => `${t} a été refusée.`],
  sold: ["UPDATE listings SET status = 'sold' WHERE id = $1", (t) => `${t} est marquée vendue.`],
  pending: ["UPDATE listings SET status = 'pending' WHERE id = $1", (t) => `${t} est remise à valider.`],
};

/** Applique une action admin. Renvoie le message à afficher, null si l'action est inconnue, undefined si l'annonce n'existe pas. */
async function applyAction(id, action) {
  const row = await get(id);
  if (!row) return undefined;
  const label = `« ${row.title} »`;
  if (SET_STATUS[action]) {
    await db.run(SET_STATUS[action][0], [id]);
    return SET_STATUS[action][1](label);
  }
  if (action === 'delete') {
    const files = await photos(id);
    await db.run('DELETE FROM listings WHERE id = $1', [id]);
    files.forEach((p) => removeUpload(p.filename));
    return `${label} a été supprimée.`;
  }
  return null;
}

/** Forme publique d'une annonce (site et API). Le numéro est public avec l'accord du vendeur. */
const toPublic = (l, photoRows = []) => ({
  id: l.id,
  kind: l.kind,
  title: l.title,
  brand: l.brand,
  model: l.model,
  year: l.year,
  mileage: l.mileage,
  price: l.price,
  city: l.city,
  description: l.description,
  sellerName: l.seller_name,
  sellerPhone: l.seller_phone,
  status: l.status,
  createdAt: l.created_at,
  approvedAt: l.approved_at,
  coverUrl: l.cover ? `/uploads/t_${l.cover}` : null,
  photos: photoRows.map((p) => ({ url: `/uploads/${p.filename}`, thumbUrl: `/uploads/t_${p.filename}` })),
  pageUrl: `/annonces/${l.id}`,
});

module.exports = {
  search, latest, get, photos, brands, validate, pendingCountForPhone, create,
  countsByStatus, listByStatus, applyAction, toPublic,
};

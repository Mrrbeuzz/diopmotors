'use strict';
/** Produits de la boutique : requêtes et validation, partagées par le site et l'API. */
const db = require('../db');
const config = require('../config');
const { clean, cleanText, toInt, likeEscape } = require('../lib/text');
const { removeUpload } = require('../lib/images');

/** Produits visibles, avec recherche, catégorie et pagination. */
async function list({ q = '', cat = '', page = 1 } = {}) {
  const { values, add } = db.params();
  const where = ['active'];
  if (config.productCategories.includes(cat)) {
    where.push(`category = ${add(cat)}`);
  } else {
    cat = '';
  }
  if (q) {
    const like = add(`%${likeEscape(q)}%`);
    where.push(`(name ILIKE ${like} ESCAPE '\\' OR description ILIKE ${like} ESCAPE '\\')`);
  }
  const w = where.join(' AND ');
  const total = (await db.one(`SELECT COUNT(*) AS n FROM products WHERE ${w}`, values)).n;
  const per = config.perPageProducts;
  const pages = Math.max(1, Math.ceil(total / per));
  const current = Math.min(Math.max(1, page), pages);
  const items = await db.all(
    `SELECT * FROM products WHERE ${w} ORDER BY featured DESC, id DESC LIMIT ${add(per)} OFFSET ${add((current - 1) * per)}`,
    values,
  );
  return { items, total, page: current, pages, cat };
}

const featured = (n) => db.all('SELECT * FROM products WHERE active ORDER BY featured DESC, id DESC LIMIT $1', [n]);

/** Un produit visible, ou undefined. */
const getActive = async (id) => (db.validId(id) ? db.one('SELECT * FROM products WHERE id = $1 AND active', [id]) : undefined);

const getAny = async (id) => (db.validId(id) ? db.one('SELECT * FROM products WHERE id = $1', [id]) : undefined);

/** Produits visibles pour une liste d'identifiants (panier). */
function byIds(ids) {
  const list = ids.filter(db.validId).slice(0, 50);
  if (!list.length) return [];
  return db.all('SELECT * FROM products WHERE active AND id = ANY($1::int[])', [`{${list.join(',')}}`]);
}

const listAll = () => db.all('SELECT * FROM products ORDER BY active DESC, category, name');

const lowStock = (limit = 8) => db.all(
  'SELECT * FROM products WHERE active AND stock <= 3 ORDER BY stock, name LIMIT $1', [limit],
);

const count = async () => (await db.one('SELECT COUNT(*) AS n FROM products')).n;

/** Vérifie les champs du formulaire produit. */
function validate(raw) {
  const errors = [];
  const data = {
    name: clean(raw.name, 120),
    category: String(raw.category || ''),
    description: cleanText(raw.description, 2000),
    price: toInt(raw.price),
    stock: toInt(raw.stock),
    featured: Boolean(raw.featured),
    active: Boolean(raw.active),
  };
  if (!data.name) errors.push('Indiquez le nom du produit.');
  if (!config.productCategories.includes(data.category)) errors.push('Choisissez une catégorie.');
  if (data.price === null || data.price > 1_000_000_000) errors.push('Indiquez un prix valide.');
  if (data.stock === null || data.stock > 100000) errors.push('Indiquez le stock (0 si épuisé).');
  return { data, errors };
}

async function create(data, image) {
  const row = await db.one(
    `INSERT INTO products (name, category, description, price, stock, image, featured, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [data.name, data.category, data.description, data.price, data.stock, image || null, data.featured, data.active],
  );
  return row.id;
}

async function update(id, data, image) {
  await db.run(
    `UPDATE products SET name=$1, category=$2, description=$3, price=$4, stock=$5, image=$6, featured=$7, active=$8
     WHERE id=$9`,
    [data.name, data.category, data.description, data.price, data.stock, image || null, data.featured, data.active, id],
  );
}

async function remove(id) {
  const row = await getAny(id);
  if (!row) return null;
  await db.run('DELETE FROM products WHERE id = $1', [id]);
  removeUpload(row.image);
  return row;
}

/** Forme publique d'un produit (site et API). */
const toPublic = (p) => ({
  id: p.id,
  name: p.name,
  category: p.category,
  description: p.description,
  price: p.price,
  stock: p.stock,
  imageUrl: p.image ? `/uploads/${p.image}` : null,
  thumbUrl: p.image ? `/uploads/t_${p.image}` : null,
  pageUrl: `/boutique/${p.id}`,
});

module.exports = { list, featured, getActive, getAny, byIds, listAll, lowStock, count, validate, create, update, remove, toPublic };

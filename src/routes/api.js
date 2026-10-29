'use strict';
/**
 * API JSON publique (version 1). Elle sert le site et servira l'application mobile.
 * Elle ne contient aucune action d'administration et n'utilise aucun cookie.
 *
 *   GET  /api/v1/config
 *   GET  /api/v1/products?q=&cat=&page=      ou  ?ids=1,2,3
 *   GET  /api/v1/products/:id
 *   GET  /api/v1/listings?type=&brand=&q=&max_price=&sort=&page=
 *   GET  /api/v1/listings/:id
 *   POST /api/v1/listings   (multipart/form-data, crée une annonce « à valider »)
 */
const config = require('../config');
const { HttpError } = require('../lib/http');
const { clean, toInt } = require('../lib/text');
const products = require('../services/products');
const listings = require('../services/listings');
const { submitListing } = require('../services/submit');

const CORS = { 'Access-Control-Allow-Origin': '*' };
const TRUE_VALUES = ['1', 'true', 'on', 'yes', 'oui'];

function register(router, { limiter }) {
  router.get('/api/v1/config', (ctx) => {
    ctx.json({
      siteName: config.siteName,
      currency: config.currency,
      whatsappNumber: config.whatsappNumber,
      productCategories: config.productCategories,
      listingKinds: Object.entries(config.listingKinds).map(([key, label]) => ({ key, label })),
      maxPhotos: config.maxPhotos,
    }, 200, CORS);
  });

  router.get('/api/v1/products', async (ctx) => {
    const ids = ctx.q('ids');
    if (ids) {
      const list = (ids.match(/\d+/g) || []).slice(0, 50).map(Number);
      return ctx.json({ items: (await products.byIds(list)).map(products.toPublic) }, 200, CORS);
    }
    const result = await products.list({ q: clean(ctx.q('q'), 60), cat: ctx.q('cat'), page: toInt(ctx.q('page')) || 1 });
    ctx.json({
      items: result.items.map(products.toPublic), total: result.total, page: result.page, pages: result.pages,
    }, 200, CORS);
  });

  router.get('/api/v1/products/:id(\\d+)', async (ctx) => {
    const p = await products.getActive(Number(ctx.params.id));
    if (!p) throw new HttpError(404);
    ctx.json(products.toPublic(p), 200, CORS);
  });

  router.get('/api/v1/listings', async (ctx) => {
    const result = await listings.search({
      kind: ctx.q('type'),
      brand: clean(ctx.q('brand'), 40),
      q: clean(ctx.q('q'), 60),
      maxPrice: toInt(ctx.q('max_price')) || null,
      sort: ctx.q('sort') || 'recent',
      page: toInt(ctx.q('page')) || 1,
    });
    ctx.json({
      items: result.items.map((l) => listings.toPublic(l)), total: result.total, page: result.page, pages: result.pages,
    }, 200, CORS);
  });

  router.get('/api/v1/listings/:id(\\d+)', async (ctx) => {
    const l = await listings.get(Number(ctx.params.id));
    if (!l || (l.status !== 'approved' && l.status !== 'sold')) throw new HttpError(404);
    ctx.json(listings.toPublic(l, await listings.photos(l.id)), 200, CORS);
  });

  router.post('/api/v1/listings', async (ctx) => {
    const form = await ctx.form();
    if (!limiter.allowed(`deposit:${ctx.ip}`, 10, 3600_000)) throw new HttpError(429);
    limiter.record(`deposit:${ctx.ip}`);

    const result = await submitListing({
      kind: form.get('kind'),
      brand: form.get('brand'),
      model: form.get('model'),
      year: form.get('year'),
      mileage: form.get('mileage'),
      price: form.get('price'),
      city: form.get('city'),
      description: form.get('description'),
      sellerName: form.get('sellerName') || form.get('seller_name'),
      phone: form.get('phone'),
      consent: TRUE_VALUES.includes(form.get('consent').toLowerCase()),
    }, form.files('photos'), form.files('thumbs'));

    if (result.errors) return ctx.json({ errors: result.errors }, 422);
    ctx.json({ id: result.id, status: 'pending' }, 201);
  });
}

module.exports = { register };

'use strict';
/** Pages publiques : accueil, boutique, panier, annonces, dépôt d'annonce. */
const { HttpError } = require('../lib/http');
const { clean, toInt } = require('../lib/text');
const products = require('../services/products');
const listings = require('../services/listings');
const { submitListing } = require('../services/submit');
const { home } = require('../views/home');
const { shop, product, cart } = require('../views/shop');
const { listingsPage, listingPage } = require('../views/listings');
const { deposit, thanks } = require('../views/deposit');
const { tips } = require('../views/info');

function register(router, { viewOf, limiter }) {
  router.get('/', async (ctx) => {
    const [latest, featured] = await Promise.all([listings.latest(6), products.featured(4)]);
    ctx.html(home(viewOf(ctx), { listings: latest, products: featured }));
  });

  router.get('/conseils', (ctx) => ctx.html(tips(viewOf(ctx))));

  // ---- Boutique ----
  router.get('/boutique', async (ctx) => {
    const q = clean(ctx.q('q'), 60);
    const result = await products.list({ q, cat: ctx.q('cat'), page: toInt(ctx.q('page')) || 1 });
    ctx.html(shop(viewOf(ctx), { ...result, q }));
  });

  router.get('/boutique/:id(\\d+)', async (ctx) => {
    const p = await products.getActive(Number(ctx.params.id));
    if (!p) throw new HttpError(404);
    ctx.html(product(viewOf(ctx), { p }));
  });

  router.get('/panier', (ctx) => ctx.html(cart(viewOf(ctx))));

  // ---- Annonces ----
  router.get('/annonces', async (ctx) => {
    const brand = clean(ctx.q('marque'), 40);
    const q = clean(ctx.q('q'), 60);
    const maxPrice = toInt(ctx.q('prix_max')) || null;
    const result = await listings.search({
      kind: ctx.q('type'), brand, q, maxPrice, sort: ctx.q('tri') || 'recent', page: toInt(ctx.q('page')) || 1,
    });
    ctx.html(listingsPage(viewOf(ctx), { ...result, brand, q, maxPrice, brands: await listings.brands() }));
  });

  router.get('/annonces/deposer', (ctx) => ctx.html(deposit(viewOf(ctx))));

  router.get('/annonces/merci', (ctx) => ctx.html(thanks(viewOf(ctx))));

  router.get('/annonces/:id(\\d+)', async (ctx) => {
    const l = await listings.get(Number(ctx.params.id));
    if (!l) throw new HttpError(404);
    const visible = l.status === 'approved' || l.status === 'sold';
    if (!visible && !ctx.session.get('admin')) throw new HttpError(404);
    ctx.html(listingPage(viewOf(ctx), { l, photos: await listings.photos(l.id) }));
  });

  router.post('/annonces/deposer', async (ctx) => {
    const form = await ctx.form();

    // Champ piège : un humain ne le remplit pas. On fait semblant d'accepter.
    if (form.get('website')) return ctx.redirect('/annonces/merci');

    if (!limiter.allowed(`deposit:${ctx.ip}`, 10, 3600_000)) throw new HttpError(429);
    limiter.record(`deposit:${ctx.ip}`);

    const values = {};
    for (const key of ['kind', 'brand', 'model', 'year', 'mileage', 'price', 'city', 'description', 'seller_name', 'phone', 'consent']) {
      values[key] = form.get(key);
    }
    const result = await submitListing(
      { ...values, sellerName: values.seller_name },
      form.files('photos'),
      form.files('thumbs'),
    );
    if (result.errors) return ctx.html(deposit(viewOf(ctx), { f: values, errors: result.errors }), 422);
    ctx.redirect('/annonces/merci');
  });
}

module.exports = { register };

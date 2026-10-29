'use strict';
/** Espace admin : validation des annonces, gestion des produits. */
const config = require('../config');
const { HttpError } = require('../lib/http');
const { safeEqual } = require('../lib/security');
const { saveUpload, removeUpload } = require('../lib/images');
const products = require('../services/products');
const listings = require('../services/listings');
const view = require('../views/admin');

/** N'accepte qu'une adresse interne du site (évite les redirections vers un autre site). */
const safeNext = (target, fallback) => (
  typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') && !target.includes('\\') ? target : fallback
);

const IMAGE_ERROR = "L'image n'a pas pu être lue. Utilisez un fichier JPG ou PNG.";
const IMAGE_TOO_LARGE = `L'image est trop lourde (${config.maxFileMb} Mo maximum).`;
const imageErrorText = (code) => (code === 'toolarge' ? IMAGE_TOO_LARGE : IMAGE_ERROR);

function register(router, { viewOf, limiter }) {
  const admin = (handler) => async (ctx) => {
    if (!ctx.session.get('admin')) return ctx.redirect('/admin/connexion?next=' + encodeURI(ctx.path), 302);
    return handler(ctx);
  };

  // ---- Connexion ----
  const loginPage = (ctx, error) => ctx.html(
    view.login(viewOf(ctx), { error, defaultPassword: config.adminPassword === 'changeme' }),
    error ? 401 : 200,
  );

  router.get('/admin/connexion', (ctx) => loginPage(ctx));

  router.post('/admin/connexion', async (ctx) => {
    const form = await ctx.form();
    const key = `login:${ctx.ip}`;
    if (!limiter.allowed(key, 5, 600_000)) {
      ctx.res.setHeader('Retry-After', '600');
      return ctx.html(view.login(viewOf(ctx), { error: 'Trop de tentatives. Réessayez dans quelques minutes.', defaultPassword: false }), 429);
    }
    if (!safeEqual(form.get('password'), config.adminPassword)) {
      limiter.record(key, 600_000);
      return loginPage(ctx, 'Mot de passe incorrect.');
    }
    ctx.session.reset();
    ctx.session.set('admin', true);
    ctx.redirect(safeNext(ctx.q('next'), '/admin'));
  });

  router.post('/admin/deconnexion', (ctx) => {
    ctx.session.reset();
    ctx.redirect('/');
  });

  // ---- Tableau de bord ----
  router.get('/admin', admin(async (ctx) => {
    const [counts, productCount, low] = await Promise.all([
      listings.countsByStatus(), products.count(), products.lowStock(),
    ]);
    ctx.html(view.dashboard(viewOf(ctx), { counts, productCount, low }));
  }));

  // ---- Annonces ----
  router.get('/admin/annonces', admin(async (ctx) => {
    const status = view.STATUSES.some(([key]) => key === ctx.q('statut')) ? ctx.q('statut') : 'pending';
    const [rows, counts] = await Promise.all([listings.listByStatus(status), listings.countsByStatus()]);
    ctx.html(view.listings(viewOf(ctx), { rows, status, counts }));
  }));

  router.post('/admin/annonces/:id(\\d+)/:action', admin(async (ctx) => {
    const form = await ctx.form();
    const message = await listings.applyAction(Number(ctx.params.id), ctx.params.action);
    if (message === undefined || message === null) throw new HttpError(404);
    ctx.session.flash(ctx.params.action === 'approve' ? 'ok' : 'info', message);
    ctx.redirect(safeNext(form.get('back'), '/admin/annonces'));
  }));

  // ---- Produits ----
  router.get('/admin/produits', admin(async (ctx) => {
    ctx.html(view.products(viewOf(ctx), { rows: await products.listAll() }));
  }));

  const rawProduct = (form) => ({
    name: form.get('name'),
    category: form.get('category'),
    description: form.get('description'),
    price: form.get('price'),
    stock: form.get('stock'),
    featured: form.get('featured'),
    active: form.get('active'),
  });

  router.get('/admin/produits/nouveau', admin((ctx) => {
    ctx.html(view.productForm(viewOf(ctx), { p: null, f: { stock: '10', active: '1' } }));
  }));

  router.post('/admin/produits/nouveau', admin(async (ctx) => {
    const form = await ctx.form();
    const raw = rawProduct(form);
    const { data, errors } = products.validate(raw);
    let image = null;
    const file = form.files('image')[0];
    if (!errors.length && file) {
      const result = await saveUpload(file, form.files('image_thumb')[0]);
      if (result.error) errors.push(imageErrorText(result.error)); else image = result.name;
    }
    if (errors.length) return ctx.html(view.productForm(viewOf(ctx), { p: null, f: raw, errors }), 422);
    await products.create(data, image);
    ctx.session.flash('ok', 'Produit ajouté.');
    ctx.redirect('/admin/produits');
  }));

  router.get('/admin/produits/:id(\\d+)/modifier', admin(async (ctx) => {
    const p = await products.getAny(Number(ctx.params.id));
    if (!p) throw new HttpError(404);
    ctx.html(view.productForm(viewOf(ctx), {
      p, f: { ...p, active: p.active ? '1' : '', featured: p.featured ? '1' : '' },
    }));
  }));

  router.post('/admin/produits/:id(\\d+)/modifier', admin(async (ctx) => {
    const p = await products.getAny(Number(ctx.params.id));
    if (!p) throw new HttpError(404);
    const form = await ctx.form();
    const raw = rawProduct(form);
    const { data, errors } = products.validate(raw);

    let image = p.image;
    let oldImage = null;
    const file = form.files('image')[0];
    if (!errors.length && file) {
      const result = await saveUpload(file, form.files('image_thumb')[0]);
      if (result.error) {
        errors.push(imageErrorText(result.error));
      } else {
        oldImage = p.image;
        image = result.name;
      }
    } else if (!errors.length && form.get('remove_image')) {
      oldImage = p.image;
      image = null;
    }
    if (errors.length) return ctx.html(view.productForm(viewOf(ctx), { p, f: raw, errors }), 422);

    await products.update(p.id, data, image);
    removeUpload(oldImage);
    ctx.session.flash('ok', 'Produit mis à jour.');
    ctx.redirect('/admin/produits');
  }));

  router.post('/admin/produits/:id(\\d+)/supprimer', admin(async (ctx) => {
    const row = await products.remove(Number(ctx.params.id));
    if (!row) throw new HttpError(404);
    ctx.session.flash('info', `« ${row.name} » a été supprimé.`);
    ctx.redirect('/admin/produits');
  }));
}

module.exports = { register, safeNext };

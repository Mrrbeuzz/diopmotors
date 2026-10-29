'use strict';
const { html } = require('../lib/html');
const config = require('../config');
const { prix, km, depuis, kindLabel } = require('../lib/format');
const { formatPhone } = require('../lib/phone');
const { layout, csrfField } = require('./layout');
const { thumb, plural, pageHeader, emptyState } = require('./components');
const { icon } = require('./icons');

const STATUSES = [['pending', 'À valider'], ['approved', 'En ligne'], ['sold', 'Vendues'], ['rejected', 'Refusées']];
const STATUS_STYLE = {
  pending: 'bg-plate-400/25 text-ink-900 ring-plate-500/40',
  approved: 'bg-wa-600/10 text-wa-700 ring-wa-600/30',
  sold: 'bg-ink-100 text-ink-700 ring-ink-200',
  rejected: 'bg-danger-50 text-danger-600 ring-danger-600/30',
};

function login(v, { error, defaultPassword }) {
  const body = html`
<section class="container-x max-w-md py-16 sm:py-24">
  <div class="card p-6 sm:p-8 motion-safe:animate-fade-up">
    <span class="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-900 text-plate-400">${icon('shield', 'h-6 w-6')}</span>
    <h1 class="mt-4 text-4xl font-extrabold">Espace admin</h1>
    ${defaultPassword ? html`<p class="notice notice-error mt-4">Le mot de passe par défaut est encore actif. Définissez <code class="font-mono">ADMIN_PASSWORD</code> dans le fichier <code class="font-mono">.env</code> avant de mettre le site en ligne.</p>` : ''}
    ${error ? html`<p class="notice notice-error mt-4" role="alert">${error}</p>` : ''}
    <form class="mt-6 grid gap-4" method="post">
      ${csrfField(v)}
      <div>
        <label class="label" for="password">Mot de passe</label>
        <input class="input" id="password" name="password" type="password" autocomplete="current-password" required autofocus>
      </div>
      <button class="btn btn-plate btn-lg btn-block" type="submit">Se connecter</button>
    </form>
  </div>
</section>`;
  return layout(v, { title: `Connexion admin, ${config.siteName}`, body, fab: false });
}

function dashboard(v, { counts, productCount, low }) {
  const n = (key) => counts[key] || 0;
  const stat = (href, value, label, alert) => html`
    <a class="card card-hover group block p-5 ${alert ? 'bg-plate-400/15 ring-plate-500/50' : ''}" href="${href}">
      <span class="block font-display text-6xl/none font-extrabold text-ink-950">${value}</span>
      <span class="mt-2 block text-sm font-semibold text-ink-600">${label}</span>
    </a>`;
  const body = html`
${pageHeader('Tableau de bord', 'Validez les nouvelles annonces et gardez le catalogue à jour.')}
<section class="container-x py-10">
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-stagger>
    ${stat('/admin/annonces?statut=pending', n('pending'), `annonce${plural(n('pending'))} à valider`, n('pending') > 0)}
    ${stat('/admin/annonces?statut=approved', n('approved'), `annonce${plural(n('approved'))} en ligne`)}
    ${stat('/admin/annonces?statut=sold', n('sold'), `vendue${plural(n('sold'))}`)}
    ${stat('/admin/produits', productCount, `produit${plural(productCount)} au catalogue`)}
  </div>

  <div class="card mt-8 p-5 sm:p-6">
    <h2 class="text-3xl font-extrabold">Stock bas</h2>
    ${low.length
      ? html`<ul class="mt-4 divide-y divide-ink-100">${low.map((p) => html`
      <li class="flex items-center justify-between gap-3 py-3">
        <a class="font-semibold hover:underline" href="/admin/produits/${p.id}/modifier">${p.name}</a>
        <span class="rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${p.stock === 0 ? STATUS_STYLE.rejected : STATUS_STYLE.pending}">${p.stock === 0 ? 'épuisé' : p.stock + ' en stock'}</span>
      </li>`)}</ul>`
      : html`<p class="mt-3 text-ink-500">Aucun produit en stock bas.</p>`}
  </div>

  <div class="mt-8 flex flex-wrap gap-3">
    <a class="btn btn-plate" href="/admin/produits/nouveau">${icon('plus', 'h-5 w-5')}Ajouter un produit</a>
    <a class="btn btn-ghost" href="/">Voir le site</a>
  </div>
</section>`;
  return layout(v, { title: `Tableau de bord, ${config.siteName}`, body, fab: false });
}

/** Petit formulaire POST pour une action sur une annonce. */
function actionForm(v, id, action, label, cls, back, confirm) {
  return html`
<form method="post" action="/admin/annonces/${id}/${action}"${confirm ? html` data-confirm="${confirm}"` : ''}>
  ${csrfField(v)}<input type="hidden" name="back" value="${back}">
  <button class="btn ${cls} btn-sm" type="submit">${label}</button>
</form>`;
}

function listings(v, { rows, status, counts }) {
  const back = `/admin/annonces?statut=${status}`;
  const body = html`
${pageHeader('Annonces', 'Relisez chaque annonce avant de la publier : photos, prix, description et numéro.')}
<section class="container-x py-10">
  <nav class="tabs" aria-label="Statut des annonces">
    ${STATUSES.map(([key, label]) => html`<a href="/admin/annonces?statut=${key}"${key === status ? html` aria-current="page"` : ''}>${label} (${counts[key] || 0})</a>`)}
  </nav>

  ${rows.length ? html`
  <ul class="mt-6 grid gap-4">
    ${rows.map((l) => html`
    <li class="card flex flex-col gap-4 p-4 sm:flex-row">
      <a class="block aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl bg-ink-100 sm:w-48" href="/annonces/${l.id}">
        ${l.cover ? html`<img class="h-full w-full object-cover" src="${thumb(l.cover)}" alt="">` : html`<span class="ph">${l.brand.charAt(0)}</span>`}
      </a>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="text-2xl font-bold normal-case"><a class="hover:underline" href="/annonces/${l.id}">${l.title}</a></h2>
          <span class="rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${STATUS_STYLE[l.status]}">${(STATUSES.find(([k]) => k === l.status) || [, l.status])[1]}</span>
          ${l.is_demo ? html`<span class="text-xs text-ink-400">démo</span>` : ''}
        </div>
        <p class="mt-1 text-sm text-ink-600">${kindLabel(l.kind)}, ${km(l.mileage)}, ${l.city}, <strong>${prix(l.price)}</strong></p>
        <p class="mt-1 text-sm text-ink-500">${l.seller_name}, ${formatPhone(l.seller_phone)}, envoyée ${depuis(l.created_at)}</p>
        <p class="line-clamp-3 mt-2 text-sm text-ink-600">${l.description}</p>
      </div>
      <div class="flex flex-row flex-wrap content-start gap-2 sm:w-40 sm:flex-col">
        ${l.status !== 'approved' ? actionForm(v, l.id, 'approve', 'Valider', 'btn-wa', back) : ''}
        ${l.status === 'pending' ? actionForm(v, l.id, 'reject', 'Refuser', 'btn-ghost', back) : ''}
        ${l.status === 'approved' ? html`
          ${actionForm(v, l.id, 'sold', 'Marquer vendue', 'btn-ghost', back)}
          ${actionForm(v, l.id, 'pending', 'Retirer du site', 'btn-ghost', back)}` : ''}
        ${actionForm(v, l.id, 'delete', 'Supprimer', 'btn-danger', back, 'Supprimer définitivement cette annonce et ses photos ?')}
      </div>
    </li>`)}
  </ul>` : html`<div class="mt-6">${emptyState(html`<p class="font-display text-3xl font-bold text-ink-900 uppercase">Rien dans cette liste</p>`)}</div>`}
</section>`;
  return layout(v, { title: `Annonces, admin, ${config.siteName}`, body, fab: false });
}

function products(v, { rows }) {
  const body = html`
${pageHeader('Produits', 'Le catalogue de la boutique : prix, stock et photos.')}
<section class="container-x py-10">
  <div class="mb-5 flex justify-end">
    <a class="btn btn-plate btn-sm" href="/admin/produits/nouveau">${icon('plus', 'h-4 w-4')}Ajouter un produit</a>
  </div>

  ${rows.length ? html`
  <div class="card overflow-x-auto">
    <table class="w-full min-w-[44rem] text-left text-sm">
      <thead class="border-b border-ink-100 bg-ink-50 text-xs tracking-wider text-ink-500 uppercase">
        <tr><th class="px-4 py-3" scope="col">Produit</th><th class="px-4 py-3" scope="col">Catégorie</th><th class="px-4 py-3" scope="col">Prix</th><th class="px-4 py-3" scope="col">Stock</th><th class="px-4 py-3" scope="col">Statut</th><th class="px-4 py-3" scope="col"><span class="sr-only">Actions</span></th></tr>
      </thead>
      <tbody class="divide-y divide-ink-100">
        ${rows.map((p) => html`
        <tr class="transition hover:bg-ink-50">
          <th class="px-4 py-3 font-semibold" scope="row"><a class="hover:underline" href="/admin/produits/${p.id}/modifier">${p.name}</a>${p.is_demo ? html` <span class="text-xs font-normal text-ink-400">démo</span>` : ''}</th>
          <td class="px-4 py-3 text-ink-600">${p.category}</td>
          <td class="px-4 py-3">${prix(p.price)}</td>
          <td class="px-4 py-3">${p.stock}</td>
          <td class="px-4 py-3">${p.active ? 'En ligne' : 'Masqué'}${p.featured ? ', mis en avant' : ''}</td>
          <td class="px-4 py-3">
            <div class="flex justify-end gap-2">
              <a class="btn btn-ghost btn-sm" href="/admin/produits/${p.id}/modifier">Modifier</a>
              <form method="post" action="/admin/produits/${p.id}/supprimer" data-confirm="Supprimer ce produit définitivement ?">
                ${csrfField(v)}
                <button class="btn btn-danger btn-sm" type="submit">Supprimer</button>
              </form>
            </div>
          </td>
        </tr>`)}
      </tbody>
    </table>
  </div>` : emptyState(html`
    <p class="font-display text-3xl font-bold text-ink-900 uppercase">Le catalogue est vide</p>
    <p>Ajoutez votre premier produit : nom, prix, stock et une photo.</p>
    <a class="btn btn-plate mt-2" href="/admin/produits/nouveau">Ajouter un produit</a>`)}
</section>`;
  return layout(v, { title: `Produits, admin, ${config.siteName}`, body, fab: false });
}

/** `p` : produit existant (modification) ou null, `f` : valeurs du formulaire. */
function productForm(v, { p, f = {}, errors = [] }) {
  const val = (name) => f[name] ?? '';
  const heading = p ? 'Modifier le produit' : 'Nouveau produit';
  const action = p ? `/admin/produits/${p.id}/modifier` : '/admin/produits/nouveau';
  const body = html`
${pageHeader(heading, 'Les clients voient le nom, le prix, la photo et la description.')}
<section class="container-x max-w-3xl py-10">
  ${errors.length ? html`<div class="notice notice-error mb-6" role="alert"><ul>${errors.map((e) => html`<li>${e}</li>`)}</ul></div>` : ''}

  <form class="card grid gap-5 p-5 sm:p-6" method="post" action="${action}" enctype="multipart/form-data" novalidate data-resize>
    ${csrfField(v)}

    <div>
      <label class="label" for="name">Nom du produit</label>
      <input class="input" id="name" name="name" value="${val('name')}" maxlength="120" required>
    </div>

    <div>
      <label class="label" for="category">Catégorie</label>
      <select class="input" id="category" name="category" required>
        <option value="">Choisir</option>
        ${config.productCategories.map((c) => html`<option value="${c}"${val('category') === c ? html` selected` : ''}>${c}</option>`)}
      </select>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <div>
        <label class="label" for="price">Prix (${config.currency})</label>
        <input class="input" id="price" name="price" type="text" inputmode="numeric" value="${val('price')}" required>
      </div>
      <div>
        <label class="label" for="stock">Stock disponible</label>
        <input class="input" id="stock" name="stock" type="text" inputmode="numeric" value="${val('stock')}" required>
      </div>
    </div>

    <div>
      <label class="label" for="description">Description</label>
      <textarea class="input" id="description" name="description" rows="5" maxlength="2000" placeholder="Compatibilité (modèles, cylindrée), contenance, marque…">${val('description')}</textarea>
    </div>

    <div>
      <label class="label" for="image">Photo</label>
      ${p && p.image ? html`
        <img class="mb-3 h-32 w-32 rounded-xl object-cover ring-1 ring-ink-200" src="${thumb(p.image)}" alt="Photo actuelle">
        <label class="check mb-3"><input type="checkbox" name="remove_image" value="1"><span>Supprimer la photo actuelle</span></label>` : ''}
      <input class="file-input" id="image" name="image" type="file" accept="image/*" data-photo-input>
      <input name="image_thumb" type="file" hidden tabindex="-1" data-thumb-input>
      <p class="hint">${p && p.image ? 'Choisir un fichier pour remplacer la photo.' : 'JPG ou PNG.'}</p>
    </div>

    <label class="check"><input type="checkbox" name="active" value="1"${val('active') ? html` checked` : ''}><span>Visible sur le site</span></label>
    <label class="check"><input type="checkbox" name="featured" value="1"${val('featured') ? html` checked` : ''}><span>Mettre en avant sur l'accueil</span></label>

    <div class="flex flex-wrap gap-3 pt-2">
      <button class="btn btn-plate" type="submit">Enregistrer</button>
      <a class="btn btn-ghost" href="/admin/produits">Annuler</a>
    </div>
  </form>
</section>`;
  return layout(v, { title: `${heading}, ${config.siteName}`, body, fab: false });
}

module.exports = { login, dashboard, listings, products, productForm, STATUSES };

'use strict';
const { html } = require('../lib/html');
const config = require('../config');
const { waUrl } = require('../lib/phone');
const { prix } = require('../lib/format');
const { queryString } = require('../lib/text');
const { layout } = require('./layout');
const { productCard, pager, plural, emptyState, pageHeader } = require('./components');
const { icon } = require('./icons');

const CHIP = 'whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-inset transition duration-200 ';
const CHIP_OFF = 'bg-white text-ink-600 ring-ink-200 hover:bg-ink-100';
const CHIP_ON = 'bg-ink-900 text-white ring-ink-900';

function shop(v, { items, total, page, pages, q, cat }) {
  const chip = (key, label) => html`<a class="${CHIP}${cat === key ? CHIP_ON : CHIP_OFF}" href="/boutique${queryString({ cat: key, q })}"${cat === key ? html` aria-current="page"` : ''}>${label}</a>`;

  const body = html`
${pageHeader('Boutique', 'Huiles, kits chaîne, pièces moteur et accessoires pour scooters et motos. Remplissez votre panier, puis envoyez la commande sur WhatsApp.')}
<section class="container-x py-10">
  <form class="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end" method="get" action="/boutique" role="search">
    <input type="hidden" name="cat" value="${cat}">
    <div class="grow">
      <label class="label" for="q">Rechercher un produit</label>
      <div class="relative">
        <span class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-400">${icon('search', 'h-5 w-5')}</span>
        <input class="input pl-11" id="q" type="search" name="q" value="${q}" placeholder="Huile 10W40, kit chaîne, plaquettes…">
      </div>
    </div>
    <button class="btn" type="submit">Rechercher</button>
  </form>

  <nav class="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Catégories">
    ${chip('', 'Tout')}
    ${config.productCategories.map((c) => chip(c, c))}
  </nav>

  <div class="mt-6">
  ${items.length
    ? html`
    <p class="mb-5 text-sm text-ink-500">${total} produit${plural(total)}</p>
    <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-stagger>${items.map(productCard)}</div>
    ${pager(v, page, pages)}`
    : emptyState(html`
      <p class="font-display text-3xl font-bold text-ink-900 uppercase">Aucun produit trouvé</p>
      <p>Essayez un autre mot, ou demandez-nous directement sur WhatsApp : nous avons peut-être la pièce en stock.</p>
      <a class="btn btn-wa mt-2" href="${waUrl(config.whatsappNumber, 'Bonjour, je cherche : ' + q)}" rel="noopener">${icon('chat', 'h-5 w-5')}Demander sur WhatsApp</a>`)}
  </div>
</section>`;
  return layout(v, { title: `Boutique, ${config.siteName}`, body });
}

function product(v, { p }) {
  const inStock = p.stock > 0;
  const message = `Bonjour ${config.siteName}, je suis intéressé par : ${p.name} (${prix(p.price)}).`;
  const body = html`
<section class="container-x py-8 sm:py-12">
  <nav class="mb-6 flex items-center gap-2 text-sm text-ink-500" aria-label="Fil d'Ariane">
    <a class="hover:text-ink-900 hover:underline" href="/boutique">Boutique</a><span aria-hidden="true">/</span>
    <a class="hover:text-ink-900 hover:underline" href="/boutique?cat=${encodeURIComponent(p.category)}">${p.category}</a>
  </nav>
  <div class="grid items-start gap-8 lg:grid-cols-2 lg:gap-12">
    <div class="card overflow-hidden motion-safe:animate-fade-in">
      <div class="aspect-square bg-ink-100 sm:aspect-[4/3]">
        ${p.image
          ? html`<img class="h-full w-full object-cover" src="/uploads/${p.image}" alt="${p.name}">`
          : html`<span class="ph">${p.category.charAt(0)}</span>`}
      </div>
    </div>
    <div class="motion-safe:animate-fade-up">
      <p class="text-sm font-semibold tracking-wider text-ink-500 uppercase">${p.category}</p>
      <h1 class="mt-1 text-4xl font-extrabold normal-case sm:text-5xl">${p.name}</h1>
      <p class="mt-5"><span class="plate plate-lg">${prix(p.price)}</span></p>
      ${inStock
        ? html`<p class="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-wa-700">${icon('check', 'h-5 w-5')}${p.stock <= 3 ? `Plus que ${p.stock} en stock` : 'En stock'}</p>`
        : html`<p class="mt-4 text-sm font-semibold text-danger-600">Épuisé pour le moment</p>`}
      ${p.description ? html`<p class="prose-x mt-5 max-w-prose text-ink-600">${p.description}</p>` : ''}

      <div class="mt-8 flex flex-wrap gap-3">
        ${inStock ? html`<button type="button" class="btn btn-plate btn-lg btn-shine" data-add="${p.id}">${icon('cart', 'h-5 w-5')}Ajouter au panier</button>` : ''}
        <a class="btn btn-wa btn-lg" rel="noopener" href="${waUrl(config.whatsappNumber, message)}">
          ${icon('chat', 'h-5 w-5')}${inStock ? 'Commander sur WhatsApp' : 'Demander la disponibilité'}
        </a>
      </div>
      <p class="mt-5 text-sm text-ink-500">Paiement et livraison réglés avec nous sur WhatsApp.</p>
    </div>
  </div>
</section>`;
  return layout(v, { title: `${p.name}, ${config.siteName}`, desc: p.description.slice(0, 150) || p.name, body });
}

function cart(v) {
  const body = html`
${pageHeader('Votre panier', 'Vérifiez vos produits, puis envoyez la commande : elle s’écrit toute seule dans WhatsApp.')}
<section class="container-x py-10" data-cart-page>
  <noscript><p class="notice">Le panier a besoin de JavaScript. Activez-le, ou commandez directement sur WhatsApp.</p></noscript>

  <div data-cart-empty hidden class="rounded-3xl border-2 border-dashed border-ink-200 bg-white px-6 py-14 text-center">
    <div class="mx-auto flex max-w-md flex-col items-center gap-3 text-ink-600">
      <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-100 text-ink-500">${icon('cart', 'h-7 w-7')}</span>
      <p class="font-display text-3xl font-bold text-ink-900 uppercase">Votre panier est vide</p>
      <p>Parcourez la boutique et ajoutez ce dont vous avez besoin.</p>
      <a class="btn btn-plate mt-2" href="/boutique">Voir la boutique</a>
    </div>
  </div>

  <div data-cart-content hidden class="grid items-start gap-8 lg:grid-cols-[1fr_24rem]">
    <ul class="grid gap-3" data-cart-list></ul>

    <aside class="card p-5 sm:p-6 lg:sticky lg:top-24">
      <h2 class="text-3xl font-extrabold">Finaliser la commande</h2>
      <p class="mt-4 flex items-center justify-between gap-3 border-t border-ink-100 pt-4 font-semibold">Total <span class="plate plate-lg" data-cart-total></span></p>
      <p class="mt-3 text-sm text-ink-500">Prix et stock vérifiés à l'envoi. Le paiement et la livraison se règlent avec nous sur WhatsApp.</p>

      <div class="mt-5">
        <label class="label" for="cart-name">Votre nom <span class="font-normal text-ink-400">(facultatif)</span></label>
        <input class="input" id="cart-name" type="text" autocomplete="name" maxlength="60">
      </div>
      <div class="mt-4">
        <label class="label" for="cart-place">Quartier ou ville de livraison <span class="font-normal text-ink-400">(facultatif)</span></label>
        <input class="input" id="cart-place" type="text" maxlength="80">
      </div>

      <a class="btn btn-wa btn-lg btn-block btn-shine mt-6" data-cart-send rel="noopener" href="#">${icon('chat', 'h-5 w-5')}Envoyer sur WhatsApp</a>
      <button type="button" class="mt-4 w-full cursor-pointer text-sm text-ink-500 underline hover:text-danger-600" data-cart-clear>Vider le panier</button>
    </aside>
  </div>

  <p data-cart-error hidden class="notice notice-error mt-4" role="alert">Impossible de charger le panier. Vérifiez votre connexion et rechargez la page.</p>
</section>`;
  return layout(v, { title: `Panier, ${config.siteName}`, body });
}

module.exports = { shop, product, cart };

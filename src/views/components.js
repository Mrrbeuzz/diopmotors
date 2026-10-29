'use strict';
const { html } = require('../lib/html');
const { prix, km, depuis, kindLabel } = require('../lib/format');
const { icon } = require('./icons');

const thumb = (name) => `/uploads/t_${name}`;

/** Lien qui rend toute la carte cliquable (le bouton « Ajouter » reste au-dessus). */
const STRETCH = 'after:absolute after:inset-0 after:content-[\'\'] focus-visible:outline-none';

function productCard(p) {
  return html`
<article class="card card-hover group reveal relative flex flex-col overflow-hidden">
  <div class="relative aspect-[4/3] overflow-hidden bg-ink-100">
    ${p.image
      ? html`<img class="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-110" src="${thumb(p.image)}" alt="" loading="lazy">`
      : html`<span class="ph">${p.category.charAt(0)}</span>`}
    ${p.stock > 0 && p.stock <= 3
      ? html`<span class="chip absolute top-3 left-3 !bg-plate-400 !text-ink-950">Plus que ${p.stock}</span>`
      : ''}
  </div>
  <div class="flex flex-1 flex-col p-4">
    <p class="text-xs font-semibold tracking-wider text-ink-500 uppercase">${p.category}</p>
    <h3 class="mt-1 text-xl/tight font-bold normal-case"><a class="${STRETCH}" href="/boutique/${p.id}">${p.name}</a></h3>
    <div class="mt-auto flex items-center justify-between gap-3 pt-4">
      <span class="plate">${prix(p.price)}</span>
      ${p.stock > 0
        ? html`<button type="button" class="btn btn-sm relative z-10" data-add="${p.id}">${icon('plus', 'h-4 w-4')}Ajouter</button>`
        : html`<span class="text-sm font-semibold text-ink-400">Épuisé</span>`}
    </div>
  </div>
</article>`;
}

function listingCard(l) {
  return html`
<article class="card card-hover group reveal relative flex flex-col overflow-hidden">
  <div class="relative aspect-[4/3] overflow-hidden bg-ink-100">
    ${l.cover
      ? html`<img class="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-110" src="${thumb(l.cover)}" alt="" loading="lazy">`
      : html`<span class="ph">${l.brand.charAt(0)}</span>`}
    <span class="chip absolute top-3 left-3">${kindLabel(l.kind)}</span>
  </div>
  <div class="flex flex-1 flex-col p-4">
    <h3 class="text-xl/tight font-bold normal-case"><a class="${STRETCH}" href="/annonces/${l.id}">${l.title}</a></h3>
    <p class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-500">
      <span class="inline-flex items-center gap-1.5">${icon('gauge', 'h-4 w-4')}${km(l.mileage)}</span>
      <span class="inline-flex items-center gap-1.5">${icon('pin', 'h-4 w-4')}${l.city}</span>
    </p>
    <div class="mt-auto flex items-center justify-between gap-3 pt-4">
      <span class="plate">${prix(l.price)}</span>
      <span class="text-xs text-ink-400">${depuis(l.approved_at)}</span>
    </div>
  </div>
</article>`;
}

/** Adresse de la page `n` en gardant les filtres de la page courante. */
function pageUrl(v, n) {
  const params = new URLSearchParams(v.query);
  params.set('page', String(n));
  return `${v.path}?${params.toString()}`;
}

function pager(v, page, pages) {
  if (pages <= 1) return '';
  return html`
<nav class="mt-10 flex items-center justify-between gap-3" aria-label="Pagination">
  ${page > 1
    ? html`<a class="btn btn-ghost btn-sm" href="${pageUrl(v, page - 1)}">Page précédente</a>`
    : html`<span></span>`}
  <span class="text-sm text-ink-500">Page ${page} sur ${pages}</span>
  ${page < pages
    ? html`<a class="btn btn-ghost btn-sm" href="${pageUrl(v, page + 1)}">Page suivante</a>`
    : html`<span></span>`}
</nav>`;
}

/** « s » au pluriel : plural(2) -> "s". */
const plural = (n) => (n > 1 ? 's' : '');

/** Titre de section avec petite barre jaune animée. */
const sectionTitle = (text, { level = 'h2', cls = '' } = {}) => html`
<div class="reveal ${cls}">
  <${level} class="text-4xl font-extrabold sm:text-5xl">${text}</${level}>
  <span class="accent-bar" aria-hidden="true"></span>
</div>`;

/** Message « rien à afficher ». */
const emptyState = (content) => html`
<div class="reveal rounded-3xl border-2 border-dashed border-ink-200 bg-white px-6 py-14 text-center">
  <div class="mx-auto flex max-w-md flex-col items-center gap-3 text-ink-600">${content}</div>
</div>`;

/** Bandeau sombre en haut des pages (titre + phrase d'introduction). */
function pageHeader(title, lead) {
  return html`
<div class="bg-ink-950 text-white">
  <div class="container-x py-10 sm:py-14">
    <h1 class="text-5xl font-extrabold text-white sm:text-6xl motion-safe:animate-fade-up">${title}</h1>
    <span class="accent-bar" aria-hidden="true"></span>
    <p class="mt-4 max-w-2xl text-lg text-ink-200 motion-safe:animate-fade-up [animation-delay:120ms]">${lead}</p>
  </div>
</div>`;
}

module.exports = { productCard, listingCard, pager, plural, thumb, sectionTitle, emptyState, pageHeader };

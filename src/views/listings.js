'use strict';
const { html } = require('../lib/html');
const config = require('../config');
const { waUrl, formatPhone } = require('../lib/phone');
const { prix, km, depuis, kindLabel } = require('../lib/format');
const { queryString } = require('../lib/text');
const { layout } = require('./layout');
const { listingCard, pager, plural, emptyState, pageHeader } = require('./components');
const { icon } = require('./icons');

function listingsPage(v, { items, total, page, pages, kind, sort, brand, q, maxPrice, brands }) {
  const filtered = Boolean(q || brand || maxPrice || kind);
  const tab = (key, label) => {
    const href = '/annonces' + queryString({ type: key, marque: brand, q, prix_max: maxPrice, tri: sort === 'recent' ? '' : sort });
    return html`<a href="${href}"${kind === key ? html` aria-current="page"` : ''}>${label}</a>`;
  };
  const sortOption = (value, label) => html`<option value="${value}"${sort === value ? html` selected` : ''}>${label}</option>`;

  const body = html`
${pageHeader('Annonces', 'Motos et scooters vendus par des particuliers. Contactez le vendeur directement par WhatsApp ou par téléphone.')}
<section class="container-x py-10">
  <div class="flex flex-wrap items-center justify-between gap-4">
    <nav class="tabs" aria-label="Type de véhicule">
      ${tab('', 'Tout')}
      ${Object.entries(config.listingKinds).map(([key, label]) => tab(key, label + 's'))}
    </nav>
    <a class="btn btn-plate btn-sm" href="/annonces/deposer">${icon('plus', 'h-4 w-4')}Déposer une annonce</a>
  </div>

  <form class="card mt-5 grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto] lg:items-end" method="get" action="/annonces" role="search">
    <input type="hidden" name="type" value="${kind}">
    <div>
      <label class="label" for="q">Recherche</label>
      <div class="relative">
        <span class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-400">${icon('search', 'h-5 w-5')}</span>
        <input class="input pl-11" id="q" type="search" name="q" value="${q}" placeholder="Modèle, ville…">
      </div>
    </div>
    <div>
      <label class="label" for="marque">Marque</label>
      <select class="input" id="marque" name="marque">
        <option value="">Toutes</option>
        ${brands.map((b) => html`<option value="${b}"${b.toLowerCase() === brand.toLowerCase() ? html` selected` : ''}>${b}</option>`)}
      </select>
    </div>
    <div>
      <label class="label" for="prix_max">Prix maximum (${config.currency})</label>
      <input class="input" id="prix_max" type="text" inputmode="numeric" name="prix_max" value="${maxPrice || ''}" placeholder="500000">
    </div>
    <div>
      <label class="label" for="tri">Trier par</label>
      <select class="input" id="tri" name="tri">
        ${sortOption('recent', 'Plus récentes')}
        ${sortOption('prix_asc', 'Prix croissant')}
        ${sortOption('prix_desc', 'Prix décroissant')}
        ${sortOption('annee', 'Année la plus récente')}
      </select>
    </div>
    <button class="btn" type="submit">Filtrer</button>
  </form>

  <div class="mt-8">
  ${items.length
    ? html`
    <p class="mb-5 text-sm text-ink-500">${total} annonce${plural(total)}</p>
    <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-stagger>${items.map(listingCard)}</div>
    ${pager(v, page, pages)}`
    : emptyState(html`
      ${filtered
        ? html`<p class="font-display text-3xl font-bold text-ink-900 uppercase">Aucune annonce ne correspond</p>
        <p>Retirez un filtre ou <a class="font-semibold underline" href="/annonces">revoyez toutes les annonces</a>.</p>`
        : html`<p class="font-display text-3xl font-bold text-ink-900 uppercase">Aucune annonce pour le moment</p>
        <p>Vous avez une moto ou un scooter à vendre ? Soyez le premier à le publier.</p>`}
      <a class="btn btn-plate mt-2" href="/annonces/deposer">Déposer une annonce</a>`)}
  </div>
</section>`;
  return layout(v, { title: `Annonces motos et scooters, ${config.siteName}`, body });
}

function listingPage(v, { l, photos }) {
  const message = `Bonjour, je suis intéressé par votre annonce : ${l.title} à ${prix(l.price)} sur ${config.siteName} (annonce n°${l.id}).`;
  const wa = waUrl(l.seller_phone, message);
  const tel = `tel:+${l.seller_phone}`;
  const spec = (ic, label, value) => html`
    <div class="flex items-center gap-3 rounded-xl bg-ink-50 p-3 ring-1 ring-ink-100">
      <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-ink-700 ring-1 ring-ink-100">${icon(ic, 'h-5 w-5')}</span>
      <div class="min-w-0"><dt class="text-xs font-semibold tracking-wider text-ink-500 uppercase">${label}</dt><dd class="truncate font-semibold text-ink-900">${value}</dd></div>
    </div>`;

  const body = html`
<section class="container-x py-8 pb-28 sm:py-12 lg:pb-12">
  <nav class="mb-6 flex items-center gap-2 text-sm text-ink-500" aria-label="Fil d'Ariane">
    <a class="hover:text-ink-900 hover:underline" href="/annonces">Annonces</a><span aria-hidden="true">/</span>
    <a class="hover:text-ink-900 hover:underline" href="/annonces?type=${l.kind}">${kindLabel(l.kind)}s</a>
  </nav>

  ${l.status === 'sold'
    ? html`<p class="mb-6 rounded-xl bg-ink-900 px-4 py-3 font-semibold text-white">Cette annonce n'est plus disponible : le véhicule a été vendu.</p>`
    : l.status !== 'approved'
      ? html`<p class="mb-6 rounded-xl bg-plate-400/20 px-4 py-3 text-sm font-semibold text-ink-900 ring-1 ring-plate-500/40">
      Aperçu administrateur : cette annonce n'est pas visible du public (${l.status === 'pending' ? 'en attente de validation' : 'refusée'}).
      <a class="underline" href="/admin/annonces?statut=${l.status}">Retour à la liste</a>
    </p>`
      : ''}

  <div class="grid items-start gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
    <div class="motion-safe:animate-fade-in">
      ${photos.length
        ? html`
        <div class="card overflow-hidden"><div class="aspect-[4/3] bg-ink-100">
          <img class="h-full w-full object-cover transition-opacity duration-200" src="/uploads/${photos[0].filename}" alt="${l.title}" data-main>
        </div></div>
        ${photos.length > 1 ? html`
        <ul class="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6">
          ${photos.map((ph, i) => html`
          <li>
            <button type="button" class="aspect-square w-full cursor-pointer overflow-hidden rounded-xl opacity-70 ring-2 ring-transparent transition duration-200 hover:opacity-100 aria-[current=true]:opacity-100 aria-[current=true]:ring-plate-500"
              data-thumb="/uploads/${ph.filename}" aria-label="Voir la photo ${i + 1}"${i === 0 ? html` aria-current="true"` : ''}>
              <img class="h-full w-full object-cover" src="/uploads/t_${ph.filename}" alt="">
            </button>
          </li>`)}
        </ul>` : ''}`
        : html`<div class="card overflow-hidden"><div class="aspect-[4/3]"><span class="ph">${l.brand.charAt(0)}</span></div></div>`}
    </div>

    <div class="motion-safe:animate-fade-up">
      <span class="chip">${kindLabel(l.kind)}</span>
      <h1 class="mt-3 text-4xl font-extrabold normal-case sm:text-5xl">${l.title}</h1>
      <p class="mt-4"><span class="plate plate-lg">${prix(l.price)}</span></p>

      <dl class="mt-6 grid gap-3 sm:grid-cols-2">
        ${spec('tag', 'Marque', l.brand)}
        ${spec('wrench', 'Modèle', l.model)}
        ${spec('calendar', 'Année', l.year)}
        ${spec('gauge', 'Kilométrage', km(l.mileage))}
        ${spec('pin', 'Ville', l.city)}
        ${spec('user', 'Vendeur', l.seller_name)}
      </dl>

      <h2 class="mt-8 text-2xl font-bold">Description</h2>
      <p class="prose-x mt-2 text-ink-600">${l.description}</p>

      ${l.status !== 'sold' ? html`
      <div class="card mt-8 hidden p-5 lg:block">
        <p class="font-semibold text-ink-900">Contacter ${l.seller_name}</p>
        <div class="mt-4 flex flex-wrap gap-3">
          <a class="btn btn-wa btn-shine grow" rel="noopener" href="${wa}">${icon('chat', 'h-5 w-5')}Écrire sur WhatsApp</a>
          <a class="btn btn-ghost grow" href="${tel}">${icon('phone', 'h-5 w-5')}${formatPhone(l.seller_phone)}</a>
        </div>
      </div>` : ''}

      <aside class="notice notice-tip mt-6">
        <p class="flex items-center gap-2 font-semibold text-ink-900">${icon('shield', 'h-5 w-5 text-plate-600')}Avant d'acheter</p>
        <ul>
          <li>Voyez le véhicule en personne avant tout paiement.</li>
          <li>Vérifiez la carte grise et que le nom correspond à celui du vendeur.</li>
          <li>Ne versez jamais d'avance à quelqu'un que vous n'avez pas rencontré.</li>
        </ul>
        <p class="mt-3"><a class="font-semibold underline" href="/conseils">Tous les conseils</a></p>
      </aside>

      <p class="mt-6 text-sm text-ink-500">Annonce n°${l.id}${l.approved_at ? html`, publiée ${depuis(l.approved_at)}` : ''}. ${config.siteName} n'est pas partie à la vente : elle se conclut entre l'acheteur et le vendeur.</p>
    </div>
  </div>
</section>

${l.status !== 'sold' ? html`
<div class="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white/95 p-3 backdrop-blur lg:hidden">
  <div class="container-x grid grid-cols-[1fr_auto] gap-3 !px-1">
    <a class="btn btn-wa" rel="noopener" href="${wa}">${icon('chat', 'h-5 w-5')}WhatsApp</a>
    <a class="btn btn-ghost" href="${tel}" aria-label="Appeler ${formatPhone(l.seller_phone)}">${icon('phone', 'h-5 w-5')}Appeler</a>
  </div>
</div>` : ''}`;
  return layout(v, {
    title: `${l.title}, ${config.siteName}`,
    desc: `${l.title} à ${prix(l.price)} à ${l.city}. ${l.description.slice(0, 110)}`,
    body,
    fab: false,
  });
}

module.exports = { listingsPage, listingPage };

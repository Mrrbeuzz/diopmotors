'use strict';
const { html } = require('../lib/html');
const config = require('../config');
const { waUrl } = require('../lib/phone');
const { layout } = require('./layout');
const { productCard, listingCard, sectionTitle, emptyState } = require('./components');
const { icon } = require('./icons');
const { heroArt } = require('./hero-art');

const TICKER = ['Huiles et lubrifiants', 'Kits chaîne', 'Freinage', 'Batteries', 'Pneus et roues', 'Équipement du motard', 'Motos', 'Scooters', 'Pièces moteur', 'Accessoires'];

function ticker() {
  const items = TICKER.map((t) => html`
    <span class="inline-flex items-center gap-6 px-3 font-display text-2xl font-bold tracking-wider text-ink-950 uppercase">${t}<span class="h-2 w-2 rotate-45 bg-ink-950" aria-hidden="true"></span></span>`);
  return html`
<div class="overflow-hidden bg-plate-400 py-3 select-none" role="presentation">
  <div class="flex w-max whitespace-nowrap motion-safe:animate-marquee hover:[animation-play-state:paused]">
    <div class="flex">${items}</div>
    <div class="flex" aria-hidden="true">${items}</div>
  </div>
</div>`;
}

const STEPS = [
  ['camera', 'Déposez votre annonce', 'Photos, prix, état et votre numéro. Deux minutes depuis votre téléphone.'],
  ['shield', 'Nous la vérifions', "Chaque annonce est relue avant publication, pour garder le site propre et sérieux."],
  ['chat', 'Les acheteurs vous contactent', 'Directement par WhatsApp ou par appel, sans intermédiaire.'],
];

function home(v, { listings, products }) {
  const body = html`
<section class="relative isolate overflow-hidden bg-ink-950 text-white">
  <div class="pointer-events-none absolute -top-32 -right-24 -z-10 h-[28rem] w-[28rem] rounded-full bg-plate-400/20 blur-3xl motion-safe:animate-float" aria-hidden="true"></div>
  <div class="pointer-events-none absolute -bottom-40 -left-24 -z-10 h-96 w-96 rounded-full bg-wa-600/15 blur-3xl motion-safe:animate-float [animation-delay:-3s]" aria-hidden="true"></div>
  <div class="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_1px_1px,rgb(255_255_255/.06)_1px,transparent_0)] [background-size:28px_28px]" aria-hidden="true"></div>

  <div class="container-x grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.1fr_.9fr] lg:py-24">
    <div>
      <p class="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-plate-300 ring-1 ring-white/15 motion-safe:animate-fade-up">
        ${icon('bolt', 'h-4 w-4')} Boutique et annonces deux-roues
      </p>
      <h1 class="mt-5 text-5xl/[1] font-extrabold text-white sm:text-7xl/[1] motion-safe:animate-fade-up [animation-delay:120ms]">
        Tout pour votre <span class="whitespace-nowrap text-plate-400">deux-roues</span>, au même endroit.
      </h1>
      <p class="mt-6 max-w-xl text-lg text-ink-200 motion-safe:animate-fade-up [animation-delay:240ms]">
        Commandez pièces, huiles et accessoires, puis finalisez sur WhatsApp. Une moto ou un scooter à vendre&nbsp;? Déposez votre annonce en deux minutes.
      </p>
      <div class="mt-8 flex flex-wrap gap-3 motion-safe:animate-fade-up [animation-delay:360ms]">
        <a class="btn btn-plate btn-lg btn-shine" href="/annonces/deposer">Déposer une annonce ${icon('arrow', 'h-5 w-5')}</a>
        <a class="btn btn-ghost-dark btn-lg" href="/boutique">Voir la boutique</a>
      </div>
      <ul class="mt-10 grid gap-3 text-sm text-ink-200 sm:grid-cols-3 motion-safe:animate-fade-up [animation-delay:480ms]">
        <li class="flex items-start gap-2">${icon('check', 'mt-0.5 h-5 w-5 shrink-0 text-plate-400')}Annonces relues avant publication</li>
        <li class="flex items-start gap-2">${icon('check', 'mt-0.5 h-5 w-5 shrink-0 text-plate-400')}Commande finalisée sur WhatsApp</li>
        <li class="flex items-start gap-2">${icon('check', 'mt-0.5 h-5 w-5 shrink-0 text-plate-400')}Motos et scooters uniquement</li>
      </ul>
    </div>
    <div class="flex justify-center lg:justify-end motion-safe:animate-fade-in [animation-delay:300ms]">${heroArt}</div>
  </div>
  <div class="h-3 bg-ink-900 [background-image:repeating-linear-gradient(90deg,#f5c518_0_32px,transparent_32px_64px)] [background-size:64px_3px] [background-position:0_50%] [background-repeat:repeat-x] motion-safe:animate-road" aria-hidden="true"></div>
</section>

${ticker()}

<section class="section container-x">
  <div class="mb-8 flex flex-wrap items-end justify-between gap-4">
    ${sectionTitle('Dernières annonces')}
    <a class="group inline-flex items-center gap-2 font-semibold text-ink-900" href="/annonces">Toutes les annonces ${icon('arrow', 'h-5 w-5 transition group-hover:translate-x-1')}</a>
  </div>
  ${listings.length
    ? html`<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-stagger>${listings.map(listingCard)}</div>`
    : emptyState(html`
      <p class="font-display text-3xl font-bold text-ink-900 uppercase">Aucune annonce pour le moment</p>
      <p>Soyez le premier à mettre votre moto ou votre scooter en vente.</p>
      <a class="btn btn-plate mt-2" href="/annonces/deposer">Déposer une annonce</a>`)}
</section>

<section class="section container-x !pt-0">
  <div class="mb-8 flex flex-wrap items-end justify-between gap-4">
    ${sectionTitle('À la boutique')}
    <a class="group inline-flex items-center gap-2 font-semibold text-ink-900" href="/boutique">Tout le catalogue ${icon('arrow', 'h-5 w-5 transition group-hover:translate-x-1')}</a>
  </div>
  ${products.length
    ? html`<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" data-stagger>${products.map(productCard)}</div>`
    : emptyState(html`
      <p class="font-display text-3xl font-bold text-ink-900 uppercase">Le catalogue arrive bientôt</p>
      <p>Écrivez-nous sur WhatsApp pour connaître les produits disponibles.</p>
      <a class="btn btn-wa mt-2" href="${waUrl(config.whatsappNumber, 'Bonjour, quels produits avez-vous en stock ?')}" rel="noopener">${icon('chat', 'h-5 w-5')}Écrire sur WhatsApp</a>`)}
</section>

<section class="bg-white py-16 sm:py-20">
  <div class="container-x">
    ${sectionTitle('Vendre sa moto ou son scooter')}
    <ol class="mt-10 grid gap-6 md:grid-cols-3" data-stagger>
      ${STEPS.map(([ic, title, text], i) => html`
      <li class="reveal relative rounded-2xl bg-ink-50 p-6 ring-1 ring-ink-100 transition duration-300 hover:-translate-y-1 hover:shadow-lift">
        <span class="absolute -top-4 right-5 font-display text-7xl/none font-extrabold text-plate-400/40" aria-hidden="true">${i + 1}</span>
        <span class="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-900 text-plate-400">${icon(ic, 'h-6 w-6')}</span>
        <h3 class="mt-4 text-2xl font-bold">${title}</h3>
        <p class="mt-2 text-ink-600">${text}</p>
      </li>`)}
    </ol>
  </div>
</section>

<section class="container-x section">
  <div class="reveal relative isolate overflow-hidden rounded-3xl bg-ink-950 px-6 py-12 text-center text-white sm:px-12 sm:py-16">
    <div class="pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-plate-400/25 blur-3xl motion-safe:animate-float" aria-hidden="true"></div>
    <h2 class="text-4xl font-extrabold text-white sm:text-6xl">Une moto ou un scooter à vendre&nbsp;?</h2>
    <p class="mx-auto mt-4 max-w-xl text-ink-200">Publiez votre annonce en deux minutes. Les acheteurs vous contactent directement, sur votre numéro.</p>
    <div class="mt-8 flex flex-wrap justify-center gap-3">
      <a class="btn btn-plate btn-lg btn-shine" href="/annonces/deposer">Déposer une annonce</a>
      <a class="btn btn-ghost-dark btn-lg" href="/conseils">Conseils de sécurité</a>
    </div>
  </div>
</section>`;
  return layout(v, { body });
}

module.exports = { home };

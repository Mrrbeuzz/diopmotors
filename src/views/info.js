'use strict';
const { html } = require('../lib/html');
const config = require('../config');
const { waUrl } = require('../lib/phone');
const { layout } = require('./layout');
const { pageHeader } = require('./components');
const { icon } = require('./icons');

const BUYER = [
  "Voyez le véhicule en personne, démarrez-le et, si possible, faites-le essayer par un mécanicien.",
  'Demandez la carte grise et vérifiez que le nom et le numéro de série correspondent au véhicule.',
  "Méfiez-vous d'un prix très en dessous du marché ou d'un vendeur pressé.",
  "Ne versez jamais d'avance, ni de « frais de réservation », à quelqu'un que vous n'avez pas rencontré.",
  'Rencontrez le vendeur dans un lieu public, de préférence accompagné.',
];
const SELLER = [
  "Décrivez honnêtement l'état de la moto ou du scooter : les défauts annoncés évitent les litiges.",
  "Ne communiquez jamais de code reçu par SMS ni de mot de passe, même à un « acheteur » qui insiste.",
  "Ne remettez le véhicule et les papiers qu'après avoir reçu la totalité de l'argent.",
  "Préparez un document de cession et gardez une copie de la pièce d'identité de l'acheteur.",
];

const checklist = (title, ic, items) => html`
<div class="card reveal p-6">
  <h2 class="flex items-center gap-3 text-3xl font-extrabold">
    <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-ink-900 text-plate-400">${icon(ic, 'h-6 w-6')}</span>${title}
  </h2>
  <ul class="mt-5 grid gap-3">
    ${items.map((t) => html`<li class="flex items-start gap-3">${icon('check', 'mt-0.5 h-5 w-5 shrink-0 text-wa-600')}<span>${t}</span></li>`)}
  </ul>
</div>`;

function tips(v) {
  const body = html`
${pageHeader('Acheter et vendre en sécurité', `${config.siteName} met en relation acheteurs et vendeurs, mais la vente se conclut entre vous. Quelques réflexes évitent la plupart des arnaques.`)}
<section class="container-x py-10">
  <div class="grid gap-6 md:grid-cols-2">
    ${checklist('Si vous achetez', 'search', BUYER)}
    ${checklist('Si vous vendez', 'tag', SELLER)}
  </div>

  <div class="card reveal mt-6 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h2 class="flex items-center gap-2 text-3xl font-extrabold">${icon('warn', 'h-7 w-7 text-plate-600')}Signaler une annonce</h2>
      <p class="mt-2 max-w-xl text-ink-600">Une annonce vous semble suspecte, ou un véhicule est déjà vendu ? Écrivez-nous avec le numéro de l'annonce, nous la retirons.</p>
    </div>
    <a class="btn btn-wa" href="${waUrl(config.whatsappNumber, "Bonjour, je souhaite signaler l'annonce n° ")}" rel="noopener">${icon('chat', 'h-5 w-5')}Signaler sur WhatsApp</a>
  </div>
</section>`;
  return layout(v, { title: `Conseils pour acheter et vendre, ${config.siteName}`, body });
}

function errorPage(v, { title, message }) {
  const body = html`
<section class="container-x max-w-2xl py-20 text-center sm:py-28">
  <p class="font-display text-8xl font-extrabold text-plate-400 motion-safe:animate-pop" aria-hidden="true">!</p>
  <h1 class="mt-2 text-5xl font-extrabold motion-safe:animate-fade-up">${title}</h1>
  <p class="mx-auto mt-4 max-w-lg text-lg text-ink-600 motion-safe:animate-fade-up [animation-delay:120ms]">${message}</p>
  <div class="mt-8 flex flex-wrap justify-center gap-3 motion-safe:animate-fade-up [animation-delay:240ms]">
    <a class="btn btn-plate btn-lg" href="/">Retour à l'accueil</a>
    <a class="btn btn-ghost btn-lg" href="/annonces">Voir les annonces</a>
  </div>
</section>`;
  return layout(v, { title: `${title}, ${config.siteName}`, body });
}

module.exports = { tips, errorPage };

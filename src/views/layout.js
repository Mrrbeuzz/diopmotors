'use strict';
const { html } = require('../lib/html');
const config = require('../config');
const { waUrl } = require('../lib/phone');
const { icon } = require('./icons');

const DEFAULT_TITLE = `${config.siteName}, pièces et annonces deux-roues`;
const DEFAULT_DESC = 'Pièces, huiles et accessoires pour scooters et motos, et annonces de deux-roues entre particuliers.';

/** Champ caché du jeton anti-CSRF, à mettre dans chaque formulaire POST. */
const csrfField = (v) => html`<input type="hidden" name="_csrf" value="${v.csrf}">`;

/**
 * @param v    données communes (voir viewOf)
 * @param opts { title, desc, body, fab }  fab:false masque le bouton WhatsApp flottant
 */
function layout(v, { title, desc, body, fab = true }) {
  const current = (re) => (re.test(v.path) ? html` aria-current="page"` : '');

  return html`<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0a0f15">
  <title>${title || DEFAULT_TITLE}</title>
  <meta name="description" content="${desc || DEFAULT_DESC}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&amp;family=Inter:wght@400;500;600;700&amp;display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/static/css/tailwind.css">
  <script src="/static/js/boot.js"></script>
</head>
<body data-wa="${config.whatsappNumber}" data-currency="${config.currency}">
  <a class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-plate-400 focus:px-4 focus:py-2 focus:font-semibold focus:text-ink-950" href="#contenu">Aller au contenu</a>

  ${v.isAdmin ? html`
  <div class="bg-ink-800 text-xs text-ink-200">
    <div class="container-x flex flex-wrap items-center gap-x-5 gap-y-1 py-2">
      <span class="font-bold tracking-wider text-plate-400 uppercase">Mode administrateur</span>
      <a class="hover:text-white" href="/admin">Tableau de bord</a>
      <a class="hover:text-white" href="/admin/annonces">Annonces</a>
      <a class="hover:text-white" href="/admin/produits">Produits</a>
      <form method="post" action="/admin/deconnexion" class="ml-auto">
        ${csrfField(v)}
        <button type="submit" class="cursor-pointer underline hover:text-white">Se déconnecter</button>
      </form>
    </div>
  </div>` : ''}

  <header class="site-header" data-header>
    <div class="container-x flex items-center gap-4 py-3">
      <a class="plate-logo" href="/" aria-label="${config.siteName}, accueil">
        <span class="h-1.5 w-1.5 rounded-full bg-ink-950" aria-hidden="true"></span>${config.siteName}<span class="h-1.5 w-1.5 rounded-full bg-ink-950" aria-hidden="true"></span>
      </a>

      <nav class="ml-6 hidden items-center gap-6 md:flex" aria-label="Navigation principale">
        <a class="nav-link" href="/boutique"${current(/^\/boutique/)}>Boutique</a>
        <a class="nav-link" href="/annonces"${current(/^\/annonces(\/\d+)?$/)}>Annonces</a>
        <a class="nav-link" href="/conseils"${current(/^\/conseils/)}>Conseils</a>
      </nav>

      <div class="ml-auto flex items-center gap-2">
        <a class="btn btn-plate btn-sm hidden sm:inline-flex" href="/annonces/deposer">${icon('plus', 'h-4 w-4')}Déposer une annonce</a>
        <a class="cart-link" href="/panier" aria-label="Voir le panier">
          ${icon('cart', 'h-5 w-5')}<span class="hidden sm:inline">Panier</span>
          <span class="cart-count is-empty" data-cart-count>0</span>
        </a>
        <button type="button" class="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-white ring-1 ring-white/20 transition hover:bg-white/10 md:hidden"
          aria-expanded="false" aria-controls="menu-mobile" aria-label="Ouvrir le menu" data-menu-button>
          <span data-menu-open>${icon('menu', 'h-6 w-6')}</span>
          <span data-menu-close hidden>${icon('close', 'h-6 w-6')}</span>
        </button>
      </div>
    </div>

    <div id="menu-mobile" class="mobile-menu md:hidden" data-menu>
      <div>
        <nav class="container-x grid gap-1 pt-1 pb-5" aria-label="Menu mobile">
          <a class="rounded-xl px-3 py-3 text-lg font-semibold text-white hover:bg-white/10" href="/boutique">Boutique</a>
          <a class="rounded-xl px-3 py-3 text-lg font-semibold text-white hover:bg-white/10" href="/annonces">Annonces</a>
          <a class="rounded-xl px-3 py-3 text-lg font-semibold text-white hover:bg-white/10" href="/conseils">Conseils</a>
          <a class="btn btn-plate mt-2" href="/annonces/deposer">${icon('plus', 'h-5 w-5')}Déposer une annonce</a>
        </nav>
      </div>
    </div>
  </header>

  <main id="contenu">
    ${v.flashes.length ? html`
    <div class="container-x mt-6 grid gap-2">
      ${v.flashes.map((f) => html`<p class="flash flash-${f.category}" role="status">${f.message}</p>`)}
    </div>` : ''}
    ${body}
  </main>

  <footer class="mt-8 bg-ink-950 text-ink-300">
    <div class="container-x grid gap-10 py-14 md:grid-cols-[1.3fr_1fr_1fr]">
      <div>
        <a class="plate-logo" href="/"><span class="h-1.5 w-1.5 rounded-full bg-ink-950" aria-hidden="true"></span>${config.siteName}<span class="h-1.5 w-1.5 rounded-full bg-ink-950" aria-hidden="true"></span></a>
        <p class="mt-4 max-w-sm">Pièces et accessoires pour deux-roues, et annonces de motos et scooters entre particuliers.</p>
      </div>
      <nav aria-label="Pied de page">
        <p class="mb-2 font-display text-lg font-bold tracking-wider text-white uppercase">Le site</p>
        <a class="foot-link" href="/boutique">Boutique</a>
        <a class="foot-link" href="/annonces">Annonces</a>
        <a class="foot-link" href="/annonces/deposer">Déposer une annonce</a>
        <a class="foot-link" href="/conseils">Conseils pour acheter et vendre</a>
      </nav>
      <div>
        <p class="mb-2 font-display text-lg font-bold tracking-wider text-white uppercase">Une question ?</p>
        <p class="mb-4">Écrivez-nous, nous répondons sur WhatsApp.</p>
        <a class="btn btn-wa btn-sm" href="${waUrl(config.whatsappNumber, `Bonjour ${config.siteName}, j'ai une question.`)}" rel="noopener">${icon('chat', 'h-4 w-4')}Écrire sur WhatsApp</a>
      </div>
    </div>
    <div class="border-t border-white/10">
      <div class="container-x flex flex-wrap items-center justify-between gap-2 py-5 text-sm text-ink-400">
        <p>© ${new Date().getFullYear()} ${config.siteName}</p>
        ${v.isAdmin ? '' : html`<a class="hover:text-white" href="/admin/connexion">Espace admin</a>`}
      </div>
    </div>
  </footer>

  ${fab ? html`
  <a class="group fixed right-4 bottom-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-wa-600 text-white shadow-xl transition duration-300 hover:scale-110 hover:bg-wa-500 sm:right-6 sm:bottom-6"
     href="${waUrl(config.whatsappNumber, `Bonjour ${config.siteName}, j'ai une question.`)}" rel="noopener" aria-label="Écrire sur WhatsApp">
    <span class="absolute inset-0 rounded-full bg-wa-500 motion-safe:animate-ping-soft" aria-hidden="true"></span>
    ${icon('chat', 'relative h-7 w-7')}
  </a>` : ''}

  <div class="toast" role="status" aria-live="polite" data-toast></div>
  <script src="/static/js/app.js" defer></script>
</body>
</html>`;
}

module.exports = { layout, csrfField };

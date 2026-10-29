'use strict';
const { html } = require('../lib/html');
const config = require('../config');
const { layout, csrfField } = require('./layout');
const { pageHeader } = require('./components');
const { icon } = require('./icons');

const BRAND_SUGGESTIONS = ['Yamaha', 'Honda', 'Suzuki', 'Kawasaki', 'Piaggio', 'Vespa', 'Peugeot', 'Kymco', 'SYM', 'TVS', 'Bajaj', 'Haojue', 'Jakarta', 'Apache'];

/** Bloc numéroté du formulaire. */
const step = (n, title, content) => html`
<fieldset class="card reveal min-w-0 p-5 sm:p-6">
  <legend class="sr-only">${title}</legend>
  <h2 class="mb-5 flex items-center gap-3 text-3xl font-extrabold" aria-hidden="true">
    <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-plate-400 font-display text-xl text-ink-950">${n}</span>${title}
  </h2>
  ${content}
</fieldset>`;

/** `f` : valeurs déjà saisies (texte), `errors` : liste de messages. */
function deposit(v, { f = {}, errors = [] } = {}) {
  const val = (name) => f[name] ?? '';
  const thisYear = new Date().getFullYear();
  const years = [];
  for (let y = thisYear + 1; y >= 1970; y--) years.push(y);

  const body = html`
${pageHeader('Déposer une annonce', "Moto ou scooter uniquement. Votre annonce est relue avant d'apparaître sur le site, en général sous peu.")}
<section class="container-x max-w-3xl py-10">
  ${errors.length ? html`
  <div class="notice notice-error mb-6" role="alert">
    <p class="font-semibold">L'annonce n'a pas pu être envoyée :</p>
    <ul>${errors.map((e) => html`<li>${e}</li>`)}</ul>
    <p class="mt-2">Les photos sont à ajouter de nouveau.</p>
  </div>` : ''}

  <form class="grid gap-6" method="post" action="/annonces/deposer" enctype="multipart/form-data" novalidate data-resize>
    ${csrfField(v)}
    <div class="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
      <label for="website">Ne pas remplir</label>
      <input id="website" type="text" name="website" tabindex="-1" autocomplete="off">
    </div>

    ${step(1, 'Votre deux-roues', html`
      <div class="segmented" role="radiogroup" aria-label="Type de véhicule">
        ${Object.entries(config.listingKinds).map(([key, label]) => html`
        <label>
          <input type="radio" name="kind" value="${key}"${val('kind') === key ? html` checked` : ''} required>
          <span>${label}</span>
        </label>`)}
      </div>

      <div class="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label class="label" for="brand">Marque</label>
          <input class="input" id="brand" name="brand" list="brands" value="${val('brand')}" maxlength="40" placeholder="Yamaha" required>
          <datalist id="brands">${BRAND_SUGGESTIONS.map((b) => html`<option value="${b}">`)}</datalist>
        </div>
        <div>
          <label class="label" for="model">Modèle</label>
          <input class="input" id="model" name="model" value="${val('model')}" maxlength="60" placeholder="NMAX 125" required>
        </div>
        <div>
          <label class="label" for="year">Année</label>
          <select class="input" id="year" name="year" required>
            <option value="">Choisir</option>
            ${years.map((y) => html`<option value="${y}"${String(val('year')) === String(y) ? html` selected` : ''}>${y}</option>`)}
          </select>
        </div>
        <div>
          <label class="label" for="mileage">Kilométrage (km)</label>
          <input class="input" id="mileage" name="mileage" type="text" inputmode="numeric" value="${val('mileage')}" placeholder="18000" required>
        </div>
        <div>
          <label class="label" for="price">Prix demandé (${config.currency})</label>
          <input class="input" id="price" name="price" type="text" inputmode="numeric" value="${val('price')}" placeholder="650000" required>
        </div>
        <div>
          <label class="label" for="city">Ville ou quartier</label>
          <input class="input" id="city" name="city" value="${val('city')}" maxlength="60" required>
        </div>
      </div>

      <div class="mt-4">
        <label class="label" for="description">Description</label>
        <textarea class="input" id="description" name="description" rows="5" maxlength="2000" placeholder="État général, entretien récent, accessoires inclus, papiers à jour…" required>${val('description')}</textarea>
      </div>`)}

    ${step(2, 'Photos', html`
      <label class="label" for="photos">Ajoutez de 1 à ${config.maxPhotos} photos (JPG ou PNG)</label>
      <input class="file-input" id="photos" name="photos" type="file" accept="image/*" multiple required data-photo-input>
      <input name="thumbs" type="file" multiple hidden tabindex="-1" data-thumb-input>
      <p class="hint">Photographiez le véhicule de face, de côté, le tableau de bord et les éventuels défauts. La première photo sert de couverture.</p>
      <ul class="previews mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6" data-previews></ul>
      <p class="mt-3 text-sm font-semibold text-danger-600" data-photo-warning hidden>Maximum ${config.maxPhotos} photos : retirez-en pour pouvoir envoyer l'annonce.</p>`)}

    ${step(3, 'Vos coordonnées', html`
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="label" for="seller_name">Votre nom</label>
          <input class="input" id="seller_name" name="seller_name" value="${val('seller_name')}" maxlength="60" autocomplete="name" required>
        </div>
        <div>
          <label class="label" for="phone">Numéro WhatsApp</label>
          <input class="input" id="phone" name="phone" type="tel" inputmode="tel" value="${val('phone')}" autocomplete="tel" placeholder="77 123 45 67" required>
        </div>
      </div>
      <label class="check mt-5">
        <input type="checkbox" name="consent" value="1"${val('consent') ? html` checked` : ''} required>
        <span>J'accepte que mon nom et mon numéro soient visibles sur l'annonce, pour que les acheteurs me contactent.</span>
      </label>`)}

    <aside class="notice notice-tip reveal">
      <p class="flex items-center gap-2 font-semibold text-ink-900">${icon('shield', 'h-5 w-5 text-plate-600')}Pour vendre en sécurité</p>
      <ul>
        <li>Ne donnez jamais de code reçu par SMS ou de mot de passe à un acheteur.</li>
        <li>Rencontrez l'acheteur dans un lieu public, de jour.</li>
        <li>Ne remettez la moto ou les papiers qu'après avoir reçu l'argent.</li>
      </ul>
    </aside>

    <button class="btn btn-plate btn-lg btn-block btn-shine" type="submit">Envoyer mon annonce ${icon('arrow', 'h-5 w-5')}</button>
  </form>
</section>`;
  return layout(v, { title: `Déposer une annonce, ${config.siteName}`, body });
}

function thanks(v) {
  const body = html`
<section class="container-x max-w-2xl py-16 text-center sm:py-24">
  <span class="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-wa-600 text-white motion-safe:animate-pop">${icon('check', 'h-10 w-10')}</span>
  <h1 class="mt-6 text-5xl font-extrabold motion-safe:animate-fade-up">Annonce reçue</h1>
  <p class="mx-auto mt-4 max-w-xl text-lg text-ink-600 motion-safe:animate-fade-up [animation-delay:120ms]">Merci. Nous relisons votre annonce avant de la publier. Dès qu'elle est validée, elle apparaît dans la liste et les acheteurs peuvent vous contacter sur le numéro indiqué.</p>
  <div class="mt-8 flex flex-wrap justify-center gap-3 motion-safe:animate-fade-up [animation-delay:240ms]">
    <a class="btn btn-plate btn-lg" href="/annonces">Voir les annonces</a>
    <a class="btn btn-ghost btn-lg" href="/boutique">Visiter la boutique</a>
  </div>
</section>`;
  return layout(v, { title: `Annonce reçue, ${config.siteName}`, body });
}

module.exports = { deposit, thanks };

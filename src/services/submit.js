'use strict';
/** Dépôt d'une annonce : validation, enregistrement des photos, création « à valider ». */
const config = require('../config');
const listings = require('./listings');
const { saveUpload, removeUpload } = require('../lib/images');

/**
 * @param raw     champs texte (kind, brand, model, year, mileage, price, city, description, sellerName, phone, consent)
 * @param files   photos (File)
 * @param thumbs  miniatures (File), dans le même ordre que les photos (facultatif)
 * @returns { id } si l'annonce est créée, sinon { errors: [...] }
 */
async function submitListing(raw, files, thumbs = []) {
  const { data, errors } = listings.validate(raw);

  if (!files.length) errors.push('Ajoutez au moins une photo.');
  else if (files.length > config.maxPhotos) errors.push(`Maximum ${config.maxPhotos} photos.`);

  if (data.phone && (await listings.pendingCountForPhone(data.phone)) >= config.maxPendingPerPhone) {
    errors.push("Vous avez déjà plusieurs annonces en attente de validation. Patientez qu'elles soient traitées.");
  }
  if (errors.length) return { errors };

  const saved = [];
  for (let i = 0; i < files.length; i++) {
    const result = await saveUpload(files[i], thumbs.length === files.length ? thumbs[i] : undefined);
    if (result.error) {
      saved.forEach(removeUpload);
      return {
        errors: [result.error === 'toolarge'
          ? `Une des photos est trop lourde (${config.maxFileMb} Mo maximum).`
          : "Une des photos n'a pas pu être lue. Utilisez des fichiers JPG ou PNG."],
      };
    }
    saved.push(result.name);
  }

  try {
    return { id: await listings.create(data, saved) };
  } catch (err) {
    saved.forEach(removeUpload);
    throw err;
  }
}

module.exports = { submitListing };

'use strict';
/**
 * Ajoute (ou retire) des données de démonstration pour tester le site en local.
 *
 *   npm run seed         ajoute des produits et des annonces de démo
 *   npm run seed:clear   retire uniquement les données de démo
 *
 * Les produits et annonces de démo portent un marqueur : vos vraies données ne sont
 * jamais touchées par seed:clear.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../src/config');
const db = require('../src/db');
const { removeUpload } = require('../src/lib/images');
const { normalizePhone } = require('../src/lib/phone');

const IMAGES = path.join(__dirname, 'demo-images');

const PRODUCTS = [
  ['p01', 'Huile moteur 4 temps 10W40, 1 L', 'Huiles et lubrifiants', 4500, 40, 1,
    'Huile semi-synthétique pour moteurs 4 temps de scooters et petites motos. Bidon de 1 litre.'],
  ['p02', 'Huile moteur 4 temps 10W40, 4 L', 'Huiles et lubrifiants', 16000, 12, 0,
    'Le bidon de 4 litres pour plusieurs vidanges. Même qualité que le format 1 litre.'],
  ['p03', 'Kit chaîne 428, 14/42 dents', 'Kits chaîne', 18000, 8, 1,
    'Kit complet : pignon, couronne et chaîne renforcée. Vérifiez le nombre de dents de votre modèle avant de commander.'],
  ['p04', 'Plaquettes de frein avant', 'Freinage', 5000, 25, 0,
    'Plaquettes organiques pour frein à disque avant. Précisez le modèle de votre scooter à la commande.'],
  ['p05', "Bougie d'allumage", 'Moteur et pièces', 2500, 60, 0,
    'Bougie standard pour moteurs 4 temps de 50 à 150 cm3.'],
  ['p06', 'Filtre à air', 'Moteur et pièces', 3500, 3, 0,
    'Filtre à air de remplacement. Précisez le modèle de votre véhicule.'],
  ['p07', 'Batterie 12 V 7 Ah', 'Batteries et électricité', 25000, 6, 1,
    'Batterie sans entretien prête à l\'emploi, adaptée à la plupart des scooters.'],
  ['p08', 'Pneu arrière 90/90-14', 'Pneus et roues', 28000, 0, 0,
    'Pneu pour scooter, monte tubeless. Actuellement épuisé.'],
  ['p09', 'Casque intégral', 'Équipement du motard', 22000, 10, 1,
    'Casque intégral homologué avec visière anti-rayures. Plusieurs tailles disponibles, précisez la vôtre.'],
  ['p10', 'Antivol de disque', 'Accessoires', 9000, 15, 0,
    'Antivol de disque avec alarme sonore. Se range sous la selle.'],
];

// [type, marque, modèle, année, km, prix, ville, statut, il y a N jours, description, photos]
const LISTINGS = [
  ['scooter', 'Yamaha', 'NMAX 125', 2021, 18000, 1250000, 'Dakar, Mermoz', 'approved', 1,
    'Très bon état, entretien régulier avec factures. Pneus neufs, deux clés, papiers à jour. Aucun accident.', ['l1a', 'l1b']],
  ['moto', 'Honda', 'Wave 110', 2019, 32000, 420000, 'Pikine', 'approved', 3,
    "Moto économique et fiable. Vidange faite le mois dernier, freins neufs. Cause de vente : achat d'un véhicule.", ['l2a', 'l2b']],
  ['scooter', 'Piaggio', 'Liberty 125', 2018, 41000, 680000, 'Dakar, Plateau', 'approved', 5,
    'Scooter entretenu, démarre du premier coup. Quelques rayures sur la carrosserie, rien de mécanique.', ['l3a', 'l3b']],
  ['moto', 'Suzuki', 'GSX 150', 2017, 27000, 900000, 'Thiès', 'approved', 8,
    'Moto sportive en bon état général. Chaîne et pignons changés récemment. Carte grise à mon nom.', ['l4']],
  ['scooter', 'Kymco', 'Agility 125', 2020, 22000, 590000, 'Rufisque', 'approved', 12,
    'Scooter pratique pour la ville, faible consommation. Entretien chez un mécanicien de confiance.', ['l5']],
  ['moto', 'TVS', 'Apache 160', 2020, 15000, 780000, 'Dakar, Parcelles', 'approved', 16,
    'Très peu roulée, première main. Livrée avec casque et antivol.', ['l6']],
  ['scooter', 'Peugeot', 'Kisbee 50', 2016, 36000, 280000, 'Guédiawaye', 'pending', 0,
    'Petit scooter idéal pour débuter. Moteur sain, quelques défauts esthétiques.', ['l7']],
];

/** Copie une image de démo dans le dossier des photos, avec un nom aléatoire. */
function copyImage(key) {
  const name = `${crypto.randomBytes(16).toString('hex')}.jpg`;
  fs.copyFileSync(path.join(IMAGES, `${key}.jpg`), path.join(config.uploadDir, name));
  fs.copyFileSync(path.join(IMAGES, `t_${key}.jpg`), path.join(config.uploadDir, `t_${name}`));
  return name;
}

async function clear() {
  const productImages = await db.all('SELECT image FROM products WHERE is_demo AND image IS NOT NULL');
  const photos = await db.all(
    'SELECT filename FROM listing_photos WHERE listing_id IN (SELECT id FROM listings WHERE is_demo)',
  );
  await db.transaction(async (tx) => {
    await tx.query('DELETE FROM products WHERE is_demo');
    await tx.query('DELETE FROM listings WHERE is_demo');
  });
  productImages.forEach((r) => removeUpload(r.image));
  photos.forEach((r) => removeUpload(r.filename));
  console.log('Données de démonstration retirées.');
}

async function seed() {
  if ((await db.one('SELECT COUNT(*) AS n FROM products WHERE is_demo')).n) {
    console.log('Les données de démonstration existent déjà. Lancez « npm run seed:clear » pour les retirer.');
    return;
  }
  const phone = normalizePhone('77 000 00 00');
  await db.transaction(async (tx) => {
    for (const [key, name, category, price, stock, featured, description] of PRODUCTS) {
      await tx.query(
        `INSERT INTO products (name, category, description, price, stock, image, featured, is_demo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE)`,
        [name, category, description, price, stock, copyImage(key), Boolean(featured)],
      );
    }
    for (const [kind, brand, model, year, km, price, city, status, days, description, photos] of LISTINGS) {
      const { rows } = await tx.query(
        `INSERT INTO listings (kind, title, brand, model, year, mileage, price, city, description, seller_name,
           seller_phone, status, is_demo, created_at, approved_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE,
           now() - make_interval(days => $13),
           CASE WHEN $12 = 'approved' THEN now() - make_interval(days => $13) END)
         RETURNING id`,
        [kind, `${brand} ${model} ${year}`, brand, model, year, km, price, city, description, 'Vendeur démo', phone, status, days],
      );
      for (let i = 0; i < photos.length; i++) {
        await tx.query('INSERT INTO listing_photos (listing_id, filename, position) VALUES ($1,$2,$3)',
          [rows[0].id, copyImage(photos[i]), i]);
      }
    }
  });
  console.log(`${PRODUCTS.length} produits et ${LISTINGS.length} annonces de démonstration ajoutés (dont 1 annonce en attente de validation).`);
}

(async () => {
  try {
    await db.init();
    if (process.argv.includes('--clear')) await clear(); else await seed();
  } catch (err) {
    console.error(`Erreur : ${err.message}`);
    console.error('Vérifiez que PostgreSQL est démarré et que DATABASE_URL est correct dans le fichier .env.');
    process.exitCode = 1;
  } finally {
    await db.close();
  }
})();

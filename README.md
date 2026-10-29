# Diop Motors

Site de **diopmotors.com** :

- **Boutique** : vos produits (kits chaîne, huile, pièces, accessoires). Le client remplit son panier, puis le site ouvre **votre WhatsApp** avec la commande déjà écrite. Pas de paiement en ligne.
- **Annonces** : motos et scooters uniquement, déposés par des particuliers. Le vendeur laisse son numéro, l'acheteur écrit sur WhatsApp ou appelle.
- **Validation manuelle** : aucune annonce n'apparaît avant que vous l'ayez acceptée dans l'espace admin.
- **API JSON** (`/api/v1/...`) prête pour une future application mobile.

**Technique** : Node.js 22, base **PostgreSQL**, design **Tailwind CSS**. Le serveur n'a aucune dépendance npm (le client PostgreSQL est dans `src/lib/pg.js`).

## 1. Installer (une seule fois)

1. **Node.js 22 ou plus récent** (version LTS) : https://nodejs.org. Vérifiez avec `node --version`.
2. **PostgreSQL 14 ou plus récent**, au choix :
   - **Docker Desktop** (le plus simple) : dans le dossier du projet, `docker compose up -d`. La base est prête, avec les identifiants du fichier `.env.example`.
   - **Installateur Windows / Mac** : https://www.postgresql.org/download/ . Puis créez l'utilisateur et la base (dans « SQL Shell (psql) » ou pgAdmin) :
     ```sql
     CREATE USER diop WITH PASSWORD 'choisissez-un-mot-de-passe';
     CREATE DATABASE diopmotors OWNER diop;
     ```
3. Conseillé : VS Code (https://code.visualstudio.com).

## 2. Lancer en local

Dans le dossier du projet :

```
copy .env.example .env        (Windows)     cp .env.example .env        (Mac / Linux)
```

Ouvrez `.env` et réglez : `DATABASE_URL` (identifiants PostgreSQL), `WHATSAPP_NUMBER` (votre numéro) et `ADMIN_PASSWORD`. Puis :

```
npm run seed        (produits et annonces de démonstration, facultatif)
npm start
```

Ouvrez http://127.0.0.1:3000 . Au démarrage, le site crée lui-même les tables. Si la base est injoignable, il affiche la cause (serveur arrêté, mot de passe faux, base inexistante).

- Espace admin : http://127.0.0.1:3000/admin (mot de passe = `ADMIN_PASSWORD`).
- `npm run seed:clear` retire uniquement les données de démonstration.
- `npm run dev` relance le site à chaque modification du code.
- Test depuis votre téléphone (même Wi-Fi) : décommentez `HOST=0.0.0.0` dans `.env`, relancez, ouvrez `http://ADRESSE-IP-DE-VOTRE-PC:3000`.

> Sous Windows PowerShell, si `npm` est bloqué (« l'exécution de scripts est désactivée »), tapez `npm.cmd start` à la place, ou une fois : `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.

## 3. Utiliser le site

- **Produits** : Admin > Produits. Photo, prix, stock. À 0 en stock, le produit s'affiche « Épuisé ».
- **Annonces** : Admin > Annonces. Les nouvelles arrivent « À valider » : *Valider*, *Refuser*, *Marquer vendue* ou *Supprimer* (les photos sont supprimées aussi).
- **Photos** : le navigateur du vendeur réduit les photos (1600 px) et retire les informations GPS avant l'envoi. Sans JavaScript, la photo est envoyée telle quelle (infos EXIF conservées).
- **Protections intégrées** : jeton CSRF, en-têtes de sécurité (CSP), cookie de session signé, limite de tentatives de connexion (5 par 10 min) et de dépôts (10 par heure et par IP), champ piège anti-robots, contrôle du vrai type des images, 5 annonces en attente maximum par numéro, requêtes SQL paramétrées.

## 4. Changer le design (Tailwind)

Le CSS compilé est **déjà fourni** (`public/css/tailwind.css`) : le site fonctionne sans rien faire. Le design est dans :

- `src/styles/tailwind.css` : couleurs (jaune plaque, bleu nuit), polices, boutons, animations ;
- `src/views/*.js` : les pages, avec les classes Tailwind directement dans le HTML.

Pour modifier le design, installez les outils une fois (`npm install`), puis laissez tourner `npm run dev:css` pendant que vous modifiez : le CSS se recompile tout seul. `npm run build:css` fait une compilation unique.

Mouvements : apparition des blocs au défilement, scooter animé, bandeau défilant, survols des cartes, menu mobile, panier qui « rebondit ». Ils se coupent automatiquement chez les visiteurs qui ont réglé leur appareil sur « réduire les animations ».

Les polices (Barlow Condensed et Inter) se chargent depuis Google Fonts ; sans connexion, le site utilise les polices du système.

## 5. Mettre en ligne sur votre serveur

1. Installez Node.js 22+ et PostgreSQL sur le serveur (ou utilisez une base PostgreSQL hébergée : ajoutez `?sslmode=require` à `DATABASE_URL`).
2. Copiez le dossier du projet (sans `data/` ni `.env`), puis créez le `.env` du serveur : `DATABASE_URL`, `ADMIN_PASSWORD` (long !), `WHATSAPP_NUMBER`, `HTTPS=1`, `TRUST_PROXY=1`.
3. Lancez avec un gestionnaire de processus : `npm i -g pm2`, puis `pm2 start npm --name diopmotors -- start`, puis `pm2 save` et `pm2 startup`.
4. Placez Nginx (ou Cloudflare) devant, avec le certificat HTTPS, qui redirige vers `127.0.0.1:3000`. Pour Nginx : `client_max_body_size 45m;`.
5. **Sauvegardes** : deux choses à copier régulièrement :
   - la base : `pg_dump -U diop diopmotors > sauvegarde.sql`
   - le dossier `data/uploads` (les photos) et `data/secret_key`.

## 6. Tests

```
set TEST_DATABASE_URL=postgres://diop:diop@127.0.0.1:5432/diopmotors      (Windows cmd)
$env:TEST_DATABASE_URL="postgres://diop:diop@127.0.0.1:5432/diopmotors"   (PowerShell)
export TEST_DATABASE_URL=postgres://diop:diop@127.0.0.1:5432/diopmotors   (Mac / Linux)
npm test
```

Les 32 tests créent un schéma temporaire dans la base, puis le suppriment : **vos données ne sont pas touchées**.

## 7. API pour la future application mobile

| Méthode | Adresse | Rôle |
|---|---|---|
| GET | `/api/v1/config` | Devise, WhatsApp, catégories, types |
| GET | `/api/v1/products` | Produits (`q`, `cat`, `page`, ou `ids=1,2,3`) |
| GET | `/api/v1/products/:id` | Un produit |
| GET | `/api/v1/listings` | Annonces validées (`type`, `brand`, `max_price`, `sort`, `q`, `page`) |
| GET | `/api/v1/listings/:id` | Une annonce avec ses photos |
| POST | `/api/v1/listings` | Déposer une annonce (multipart ; réponse 201 `{id, status:"pending"}` ou 422 `{errors}`) |

## 8. Limites actuelles

- Pas de comptes utilisateurs : un vendeur ne peut pas modifier son annonce, seul l'admin le peut. Un seul administrateur.
- Les sessions sont dans un cookie signé : se déconnecter efface le cookie mais ne l'invalide pas côté serveur avant ses 8 heures.
- `src/schema.sql` crée les tables si elles n'existent pas, mais ne modifie pas des tables existantes : un futur changement de structure demandera un petit script de migration.
- Le client PostgreSQL (`src/lib/pg.js`) a été testé avec PostgreSQL 17 (authentification SCRAM, MD5 et mot de passe en clair). Si vous préférez le paquet standard `pg`, seul ce fichier et `src/db.js` sont à adapter.

## Structure

```
src/        serveur (routes, vues Tailwind, services, schema.sql, client PostgreSQL)
public/     CSS compilé et JavaScript du navigateur
scripts/    données de démonstration
test/       tests automatiques
data/       créé au premier lancement (photos envoyées, clé secrète)
```

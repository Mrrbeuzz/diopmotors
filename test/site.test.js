'use strict';
const h = require('./helpers');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

let env;
let anon;   // visiteur
let admin;  // administrateur connecté

const jpeg = () => ({ data: h.fixture('photo.jpg'), name: 'photo.jpg', type: 'image/jpeg' });
const png = () => ({ data: h.fixture('photo.png'), name: 'photo.png', type: 'image/png' });
const uploads = () => fs.readdirSync(path.join(h.dataDir, 'uploads'));

const goodListing = (over = {}) => ({
  kind: 'scooter', brand: 'honda', model: 'PCX 125', year: '2022', mileage: '12 000', price: '1 100 000',
  city: 'Dakar, Almadies', description: 'Scooter en excellent état <script>alert(1)</script> entretien suivi.',
  seller_name: 'Test Vendeur', phone: '77 123 45 67', consent: '1', ...over,
});

/** Requête HTTP brute (pour les chemins que fetch réécrirait). */
function raw(method, url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(env.base);
    const req = http.request({ host: u.hostname, port: u.port, method, path: url, headers }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

test.before(async () => {
  env = await h.start();
  anon = env.client();
});

test.after(() => env.stop());

test('pages publiques', async () => {
  for (const url of ['/', '/boutique', '/boutique/1', '/annonces', '/annonces/1', '/annonces/deposer', '/conseils',
    '/panier', '/admin/connexion', '/boutique?q=huile', '/boutique?cat=Freinage', '/boutique?cat=nimporte&page=99',
    '/annonces?type=moto', '/annonces?marque=yamaha', '/annonces?prix_max=600000&tri=prix_asc', '/annonces?page=99',
    '/annonces?tri=bidon&type=bidon', '/annonces/merci', '/boutique/']) {
    const r = await anon.get(url);
    assert.equal(r.status, 200, url);
    assert.match(r.headers.get('content-type'), /text\/html/, url);
  }
  const r = await anon.get('/nimporte');
  assert.equal(r.status, 404);
  assert.match(r.text, /Page introuvable/);
  assert.equal((await anon.get('/boutique/999')).status, 404);
  assert.equal((await anon.get('/annonces/999')).status, 404);
  assert.equal((await anon.get('/%E0%A4%A')).status, 400);
});

test('en-têtes de sécurité et cookie de session', async () => {
  const c = env.client();
  const r = await c.get('/');
  assert.match(r.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  const cookie = r.headers.getSetCookie()[0];
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.doesNotMatch(cookie, /Secure/);
  assert.doesNotMatch(r.text, /style="/);
});

test('filtres et tri des annonces', async () => {
  let r = await anon.get('/annonces?type=moto');
  assert.ok(!r.text.includes('NMAX') && r.text.includes('Wave 110'));
  r = await anon.get('/annonces?prix_max=450000');
  assert.ok(r.text.includes('Wave 110') && !r.text.includes('NMAX'));
  r = await anon.get('/annonces?marque=YAMAHA');
  assert.ok(r.text.includes('NMAX') && !r.text.includes('Wave'));
  r = await anon.get('/annonces?tri=prix_asc');
  assert.ok(r.text.indexOf('Wave 110') < r.text.indexOf('NMAX'));
  r = await anon.get('/annonces?q=Thi%C3%A8s');
  assert.ok(r.text.includes('GSX 150') && !r.text.includes('NMAX'));
  r = await anon.get('/boutique?q=100%25');
  assert.match(r.text, /Aucun produit/);
  r = await anon.get('/boutique?q=casque');
  assert.ok(r.text.includes('Casque intégral') && !r.text.includes('Antivol'));
});

test('annonce en attente invisible au public', async () => {
  assert.equal((await anon.get('/annonces/7')).status, 404);
  assert.ok(!(await anon.get('/annonces')).text.includes('Kisbee'));
  assert.equal((await anon.get('/api/v1/listings/7')).status, 404);
});

test('liens WhatsApp et appel', async () => {
  let r = await anon.get('/annonces/1');
  assert.ok(r.text.includes('https://wa.me/221770000000?text='));
  assert.ok(r.text.includes('href="tel:+221770000000"'));
  assert.ok(r.text.includes('+221 77 000 00 00'));
  r = await anon.get('/boutique/1');
  assert.ok(r.text.includes('wa.me/221770000000?text='));
  r = await anon.get('/boutique/8'); // pneu épuisé
  assert.ok(!r.text.includes('data-add="8"') && r.text.includes('Épuisé'));
});

test('API panier : prix et stock viennent du serveur', async () => {
  const r = await anon.get('/api/v1/products?ids=1,8,999');
  assert.equal(r.status, 200);
  const items = r.json().items;
  assert.deepEqual(items.map((p) => p.id).sort(), [1, 8]);
  assert.equal(items.find((p) => p.id === 1).price, 4500);
  assert.equal(items.find((p) => p.id === 8).stock, 0);
  assert.match(items[0].thumbUrl, /^\/uploads\/t_[a-f0-9]{32}\.jpg$/);
});

test('CSRF : un formulaire sans jeton est refusé', async () => {
  const c = env.client();
  let r = await c.post('/annonces/deposer', { brand: 'x' }, {}, { csrf: false });
  assert.equal(r.status, 400);
  await c.csrf();
  const fd = new FormData();
  fd.append('_csrf', 'mauvais-jeton');
  r = await c.req('POST', '/annonces/deposer', { body: fd });
  assert.equal(r.status, 400);
  r = await c.req('POST', '/annonces/deposer', {
    body: 'brand=x', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
  assert.equal(r.status, 400);
  r = await c.req('POST', '/annonces/deposer', { body: '{}', headers: { 'content-type': 'application/json' } });
  assert.equal(r.status, 415);
});

test('méthodes non autorisées', async () => {
  const r = await anon.req('POST', '/boutique');
  assert.equal(r.status, 405);
  assert.match(r.headers.get('allow'), /GET/);
  assert.equal((await anon.req('DELETE', '/')).status, 405);
  const head = await anon.req('HEAD', '/');
  assert.equal(head.status, 200);
  assert.equal(head.text, '');
});

test('dépôt d\'annonce : erreurs', async () => {
  const c = env.client();
  let r = await c.post('/annonces/deposer', { kind: 'voiture' });
  assert.equal(r.status, 422);
  assert.match(r.text, /n'a pas pu être envoyée/);
  assert.match(r.text, /Choisissez moto ou scooter/);
  assert.match(r.text, /Ajoutez au moins une photo/);

  r = await c.post('/annonces/deposer', goodListing(), { photos: { data: Buffer.from('pas une image'), name: 'x.jpg' } });
  assert.equal(r.status, 422);
  assert.match(r.text, /n&#39;a pas pu être lue/);

  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  r = await c.post('/annonces/deposer', goodListing(), { photos: { data: svg, name: 'x.jpg', type: 'image/svg+xml' } });
  assert.equal(r.status, 422);

  const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(7 * 1024 * 1024)]);
  r = await c.post('/annonces/deposer', goodListing(), { photos: { data: big, name: 'big.jpg' } });
  assert.equal(r.status, 422);
  assert.match(r.text, /trop lourde/);

  r = await c.post('/annonces/deposer', goodListing(), { photos: Array.from({ length: 7 }, jpeg) });
  assert.equal(r.status, 422);
  assert.match(r.text, /Maximum 6 photos/);

  r = await c.post('/annonces/deposer', goodListing({ consent: '', phone: '12', year: '1800' }), { photos: jpeg() });
  assert.equal(r.status, 422);
  assert.match(r.text, /année valide/);
  assert.match(r.text, /numéro de téléphone n&#39;est pas valide|numéro de téléphone n'est pas valide/);
  assert.match(r.text, /Acceptez que votre numéro/);
  assert.ok(r.text.includes('value="honda"'), 'les valeurs saisies sont conservées');
});

test('dépôt d\'annonce : champ piège, puis annonce valide', async () => {
  const c = env.client();
  const before = (await h.query('SELECT COUNT(*) AS n FROM listings'))[0].n;
  let r = await c.post('/annonces/deposer', { ...goodListing(), website: 'spam' }, { photos: jpeg() });
  assert.equal(r.status, 303);
  assert.equal((await h.query('SELECT COUNT(*) AS n FROM listings'))[0].n, before);

  const filesBefore = uploads().length;
  r = await c.post('/annonces/deposer', goodListing(), { photos: [jpeg(), png()] });
  assert.equal(r.status, 303);
  assert.equal(r.headers.get('location'), '/annonces/merci');

  const row = (await h.query('SELECT * FROM listings ORDER BY id DESC LIMIT 1'))[0];
  assert.equal(row.status, 'pending');
  assert.equal(row.title, 'Honda PCX 125 2022');
  assert.equal(row.seller_phone, '221771234567');
  assert.equal(row.price, 1100000);
  assert.equal(row.mileage, 12000);
  const photos = (await h.query('SELECT * FROM listing_photos WHERE listing_id = ? ORDER BY position', row.id));
  assert.deepEqual(photos.map((p) => path.extname(p.filename)), ['.jpg', '.png']);
  assert.equal(uploads().length, filesBefore + 4, 'photos + miniatures');
  assert.equal((await anon.get(`/annonces/${row.id}`)).status, 404, 'invisible avant validation');
  assert.equal((await c.get('/annonces/merci')).status, 200);
});

test('limite d\'annonces en attente par numéro', async () => {
  const c = env.client();
  env.limiter.clear();
  const phone = '78 999 00 11';
  for (let i = 0; i < 5; i++) {
    const r = await c.post('/annonces/deposer', goodListing({ phone, model: `M${i}` }), { photos: jpeg() });
    assert.equal(r.status, 303, `annonce ${i}`);
  }
  const r = await c.post('/annonces/deposer', goodListing({ phone }), { photos: jpeg() });
  assert.equal(r.status, 422);
  assert.match(r.text, /plusieurs annonces en attente/);
  (await h.query("SELECT 1")); // la base reste accessible
});

test('espace admin : accès protégé', async () => {
  const c = env.client();
  let r = await c.get('/admin');
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), '/admin/connexion?next=/admin');
  for (const url of ['/admin/annonces', '/admin/produits', '/admin/produits/nouveau', '/admin/produits/1/modifier']) {
    assert.equal((await c.get(url)).status, 302, url);
  }
  r = await c.post('/admin/annonces/1/approve', {});
  assert.equal(r.status, 302, 'action admin sans connexion');
  assert.equal((await h.query('SELECT status FROM listings WHERE id = 1'))[0].status, 'approved');
  r = await c.post('/admin/produits/1/supprimer', {});
  assert.equal(r.status, 302);
  assert.equal((await h.query('SELECT COUNT(*) AS n FROM products WHERE id = 1'))[0].n, 1);
});

test('espace admin : connexion', async () => {
  env.limiter.clear();
  const c = env.client();
  let r = await c.post('/admin/connexion', { password: 'mauvais' });
  assert.equal(r.status, 401);
  assert.match(r.text, /incorrect/);

  // Redirection ouverte refusée
  r = await c.post('/admin/connexion?next=//evil.example', { password: 'test-password' });
  assert.equal(r.status, 303);
  assert.equal(r.headers.get('location'), '/admin');
  c.token = null;
  await c.post('/admin/deconnexion');
  c.token = null;
  r = await c.post('/admin/connexion?next=/admin/annonces', { password: 'test-password' });
  assert.equal(r.headers.get('location'), '/admin/annonces');
  admin = c;
  admin.token = null;
  assert.equal((await admin.get('/admin')).status, 200);
});

test('un faux cookie de session est refusé', async () => {
  const c = env.client();
  c.jar.set('dm_session', Buffer.from(JSON.stringify({ d: { admin: true }, exp: 9999999999 })).toString('base64url') + '.AAAA');
  assert.equal((await c.get('/admin')).status, 302);
  const mine = [...admin.jar.get('dm_session').split('.')];
  const forged = Buffer.from(JSON.stringify({ d: { admin: true, x: 1 }, exp: 9999999999 })).toString('base64url');
  c.jar.set('dm_session', `${forged}.${mine[1]}`);
  assert.equal((await c.get('/admin')).status, 302);
});

test('admin : valider, vendre, refuser, supprimer', async () => {
  const pending = (await h.query("SELECT id, title FROM listings WHERE status = 'pending' AND title LIKE 'Honda PCX%' LIMIT 1"))[0];
  let r = await admin.get('/admin/annonces');
  assert.ok(r.text.includes('Honda PCX 125 2022') && r.text.includes('Kisbee'));
  assert.equal((await admin.get(`/annonces/${pending.id}`)).status, 200, 'aperçu admin');

  r = await admin.post(`/admin/annonces/${pending.id}/approve`, { back: '/admin/annonces' });
  assert.equal(r.status, 303);
  r = await admin.get('/annonces');
  assert.ok(r.text.includes('PCX 125'));

  r = await anon.get(`/annonces/${pending.id}`);
  assert.equal(r.status, 200);
  assert.ok(!r.text.includes('<script>alert(1)</script>'), 'XSS échappé');
  assert.ok(r.text.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));

  for (const url of ['/admin/annonces?statut=approved', '/admin/annonces?statut=sold', '/admin/annonces?statut=rejected',
    '/admin/annonces?statut=bidon', '/admin/produits', '/admin/produits/nouveau', '/admin/produits/1/modifier']) {
    assert.equal((await admin.get(url)).status, 200, url);
  }

  await admin.post(`/admin/annonces/${pending.id}/sold`, {});
  r = await anon.get(`/annonces/${pending.id}`);
  assert.ok(r.text.includes('a été vendu') && !r.text.includes('Appeler'));
  assert.ok(!(await anon.get('/annonces')).text.includes('PCX 125'));

  await admin.post('/admin/annonces/7/reject', {});
  assert.equal((await anon.get('/annonces/7')).status, 404);
  assert.equal((await h.query('SELECT status FROM listings WHERE id = 7'))[0].status, 'rejected');

  const files = (await h.query('SELECT filename FROM listing_photos WHERE listing_id = ?', pending.id)).map((p) => p.filename);
  assert.ok(files.length > 0 && files.every((f) => uploads().includes(f)));
  r = await admin.post(`/admin/annonces/${pending.id}/delete`, {});
  assert.equal(r.status, 303);
  assert.ok(files.every((f) => !uploads().includes(f) && !uploads().includes('t_' + f)), 'photos supprimées');
  assert.equal((await anon.get(`/annonces/${pending.id}`)).status, 404);
  assert.equal((await admin.post('/admin/annonces/1/bidon', {})).status, 404);
  assert.equal((await admin.post('/admin/annonces/9999/approve', {})).status, 404);
});

test('admin : produits (créer, modifier, masquer, supprimer)', async () => {
  let r = await admin.post('/admin/produits/nouveau', { name: '', category: 'x', price: 'abc', stock: '' });
  assert.equal(r.status, 422);
  assert.match(r.text, /Indiquez le nom/);

  r = await admin.post('/admin/produits/nouveau', {
    name: 'Chaîne test', category: 'Kits chaîne', price: '12 500', stock: '5', active: '1', description: 'd',
  }, { image: jpeg(), image_thumb: jpeg() });
  assert.equal(r.status, 303);
  let p = (await h.query("SELECT * FROM products WHERE name = 'Chaîne test'"))[0];
  assert.equal(p.price, 12500);
  assert.equal(p.stock, 5);
  assert.ok(uploads().includes(p.image));
  assert.equal((await anon.get(`/boutique/${p.id}`)).status, 200);

  r = await admin.post('/admin/produits/nouveau', { name: 'Mauvaise image', category: 'Kits chaîne', price: '1', stock: '1' },
    { image: { data: Buffer.from('texte'), name: 'a.jpg' } });
  assert.equal(r.status, 422);
  assert.equal((await h.query("SELECT COUNT(*) AS n FROM products WHERE name = 'Mauvaise image'"))[0].n, 0);

  const oldImage = p.image;
  r = await admin.post(`/admin/produits/${p.id}/modifier`, {
    name: 'Chaîne test 2', category: 'Kits chaîne', price: '13000', stock: '0', remove_image: '1',
  });
  assert.equal(r.status, 303);
  p = (await h.query('SELECT * FROM products WHERE id = ?', p.id))[0];
  assert.equal(p.name, 'Chaîne test 2');
  assert.equal(p.active, false);
  assert.equal(p.image, null);
  assert.ok(!uploads().includes(oldImage), 'ancienne image supprimée');
  assert.equal((await anon.get(`/boutique/${p.id}`)).status, 404, 'produit masqué');

  r = await admin.post(`/admin/produits/${p.id}/supprimer`, {});
  assert.equal(r.status, 303);
  assert.equal((await admin.get(`/admin/produits/${p.id}/modifier`)).status, 404);
  assert.equal((await admin.post('/admin/produits/9999/supprimer', {})).status, 404);
});

test('fichiers statiques et photos : aucune sortie du dossier', async () => {
  let r = await anon.get('/static/css/tailwind.css');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/css/);
  assert.ok(r.headers.get('etag'));
  r = await anon.req('GET', '/static/css/tailwind.css', { headers: { 'if-none-match': r.headers.get('etag') } });
  assert.equal(r.status, 304);

  for (const evil of ['/static/%2e%2e/src/config.js', '/static/..%2f..%2fpackage.json', '/static/%2e%2e%2fsrc%2fconfig.js',
    '/uploads/%2e%2e%2fsecret_key', '/uploads/..%2fdiopmotors.db', '/uploads/secret_key', '/static/css', '/static/x%00.css']) {
    const res = await raw('GET', evil);
    assert.equal(res.status, 404, evil);
    assert.ok(!res.body.includes('secret-de-test') && !res.body.includes('module.exports'), evil);
  }

  const name = (await h.query('SELECT image FROM products WHERE image IS NOT NULL LIMIT 1'))[0].image;
  r = await anon.get(`/uploads/${name}`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'image/jpeg');
  assert.equal((await anon.get(`/uploads/t_${name}`)).status, 200);
});

test('formulaire trop lourd : refusé tout de suite', async () => {
  const res = await raw('POST', '/annonces/deposer', {
    'content-type': 'multipart/form-data; boundary=x', 'content-length': String(50 * 1024 * 1024),
  });
  assert.equal(res.status, 413);
  assert.match(res.body, /Photos trop lourdes/);
});

test('blocage après 5 mots de passe faux', async () => {
  env.limiter.clear();
  const c = env.client();
  for (let i = 0; i < 5; i++) assert.equal((await c.post('/admin/connexion', { password: 'x' })).status, 401);
  const r = await c.post('/admin/connexion', { password: 'test-password' });
  assert.equal(r.status, 429);
  assert.match(r.text, /Trop de tentatives/);
  env.limiter.clear();
});

test('déconnexion', async () => {
  await admin.post('/admin/deconnexion', {});
  assert.equal((await admin.get('/admin')).status, 302);
});

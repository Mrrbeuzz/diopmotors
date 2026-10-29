'use strict';
const h = require('./helpers');
const test = require('node:test');
const assert = require('node:assert/strict');

let env;
let c;

const jpeg = () => ({ data: h.fixture('photo.jpg'), name: 'photo.jpg', type: 'image/jpeg' });
const fields = (over = {}) => ({
  kind: 'moto', brand: 'Yamaha', model: 'YBR 125', year: '2020', mileage: '15000', price: '650000',
  city: 'Thiès', description: 'Très bon état, entretien régulier, papiers à jour.',
  sellerName: 'Awa', phone: '78 555 12 12', consent: 'true', ...over,
});

test.before(async () => { env = await h.start(); c = env.client(); });
test.after(() => env.stop());

test('GET /api/v1/config', async () => {
  const r = await c.get('/api/v1/config');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /application\/json/);
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  const j = r.json();
  assert.equal(j.currency, 'FCFA');
  assert.equal(j.whatsappNumber, '221770000000');
  assert.deepEqual(j.listingKinds, [{ key: 'moto', label: 'Moto' }, { key: 'scooter', label: 'Scooter' }]);
  assert.ok(j.productCategories.includes('Kits chaîne'));
});

test('GET /api/v1/products', async () => {
  let j = (await c.get('/api/v1/products')).json();
  assert.equal(j.total, 10);
  assert.equal(j.page, 1);
  assert.ok(j.items[0].pageUrl.startsWith('/boutique/'));
  j = (await c.get('/api/v1/products?cat=Freinage')).json();
  assert.deepEqual(j.items.map((p) => p.name), ['Plaquettes de frein avant']);
  j = (await c.get('/api/v1/products?q=batterie')).json();
  assert.equal(j.total, 1);
  const one = (await c.get('/api/v1/products/3')).json();
  assert.equal(one.name, 'Kit chaîne 428, 14/42 dents');
  assert.equal(one.price, 18000);
  assert.equal((await c.get('/api/v1/products/999')).status, 404);
  assert.equal((await c.get('/api/v1/products/abc')).status, 404);
});

test('GET /api/v1/listings', async () => {
  let r = await c.get('/api/v1/listings');
  let j = r.json();
  assert.equal(j.total, 6, 'sans l\'annonce en attente');
  assert.ok(j.items.every((l) => l.status === 'approved'));
  assert.ok(j.items.every((l) => !('photos' in l) || l.photos.length === 0));
  assert.match(j.items[0].coverUrl, /^\/uploads\/t_/);

  j = (await c.get('/api/v1/listings?type=scooter&sort=prix_desc')).json();
  assert.deepEqual(j.items.map((l) => l.price), [1250000, 680000, 590000]);
  j = (await c.get('/api/v1/listings?brand=honda&max_price=500000')).json();
  assert.deepEqual(j.items.map((l) => l.title), ['Honda Wave 110 2019']);

  const one = (await c.get('/api/v1/listings/1')).json();
  assert.equal(one.title, 'Yamaha NMAX 125 2021');
  assert.equal(one.photos.length, 2);
  assert.match(one.photos[0].url, /^\/uploads\/[a-f0-9]{32}\.jpg$/);
  assert.equal(one.sellerPhone, '221770000000');
  assert.equal((await c.get('/api/v1/listings/7')).status, 404, 'en attente');
  assert.equal((await c.get('/api/v1/nimporte')).status, 404);
  assert.equal((await c.get('/api/v1/nimporte')).json().error, 'Page introuvable');
});

test('POST /api/v1/listings', async () => {
  // sans cookie ni jeton CSRF
  let r = await c.post('/api/v1/listings', fields(), { photos: jpeg(), thumbs: jpeg() }, { csrf: false });
  assert.equal(r.status, 201);
  const j = r.json();
  assert.equal(j.status, 'pending');
  const row = (await h.query('SELECT * FROM listings WHERE id = ?', j.id))[0];
  assert.equal(row.title, 'Yamaha YBR 125 2020');
  assert.equal(row.status, 'pending');
  assert.equal((await c.get(`/api/v1/listings/${j.id}`)).status, 404, 'pas public avant validation');

  r = await c.post('/api/v1/listings', fields({ price: '', consent: 'false' }), {}, { csrf: false });
  assert.equal(r.status, 422);
  const errors = r.json().errors;
  assert.ok(errors.includes('Indiquez un prix valide.'));
  assert.ok(errors.includes('Ajoutez au moins une photo.'));
  assert.ok(errors.some((e) => e.startsWith('Acceptez')));

  r = await c.post('/api/v1/listings', fields({ phone: '78 555 12 13' }), { photos: { data: Buffer.from('x'), name: 'a.jpg' } }, { csrf: false });
  assert.equal(r.status, 422);
});

test('l\'API ne donne aucun accès admin', async () => {
  for (const [m, u] of [['POST', '/api/v1/listings/1/approve'], ['DELETE', '/api/v1/listings/1'], ['GET', '/api/v1/admin']]) {
    const r = await c.req(m, u);
    assert.ok([404, 405].includes(r.status), `${m} ${u} -> ${r.status}`);
  }
  assert.equal((await h.query('SELECT status FROM listings WHERE id = 1'))[0].status, 'approved');
});

test('limitation des dépôts par adresse IP', async () => {
  env.limiter.clear();
  let last;
  for (let i = 0; i < 11; i++) {
    last = await c.post('/api/v1/listings', fields({ phone: `77 000 10 ${10 + i}` }), { photos: jpeg() }, { csrf: false });
  }
  assert.equal(last.status, 429);
  assert.equal(last.json().error, 'Trop de demandes');
  env.limiter.clear();
});

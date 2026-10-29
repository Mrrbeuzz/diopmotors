/* Diop Motors : panier, aperçu des photos, galerie, confirmations. */
(function () {
  'use strict';

  var CART_KEY = 'dm_cart';
  var body = document.body;
  var WA = body.dataset.wa || '';
  var CURRENCY = body.dataset.currency || '';

  function readCart() {
    try {
      var c = JSON.parse(localStorage.getItem(CART_KEY) || '{}');
      return c && typeof c === 'object' && !Array.isArray(c) ? c : {};
    } catch (e) { return {}; }
  }
  function writeCart(c, bump) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch (e) { /* stockage indisponible */ }
    updateBadge(bump);
  }
  function cartCount() {
    var c = readCart(), n = 0;
    Object.keys(c).forEach(function (k) { n += parseInt(c[k], 10) || 0; });
    return n;
  }
  function updateBadge(bump) {
    var n = cartCount();
    document.querySelectorAll('[data-cart-count]').forEach(function (el) {
      el.textContent = n;
      el.classList.toggle('is-empty', n === 0);
      if (bump) {
        el.classList.remove('bump');
        void el.offsetWidth; // relance l'animation
        el.classList.add('bump');
      }
    });
  }
  function fmt(n) {
    return new Intl.NumberFormat('fr-FR').format(n).replace(/ | /g, ' ') + ' ' + CURRENCY;
  }

  var toastTimer;
  function toast(msg) {
    var el = document.querySelector('[data-toast]');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  /* ---- Ajouter au panier ---- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-add]');
    if (!btn) return;
    var id = String(parseInt(btn.dataset.add, 10));
    if (!id || id === 'NaN') return;
    var cart = readCart();
    cart[id] = Math.min((parseInt(cart[id], 10) || 0) + 1, 99);
    writeCart(cart, true);
    toast('Ajouté au panier');
  });

  /* ---- Page panier ---- */
  var page = document.querySelector('[data-cart-page]');
  if (page) initCartPage(page);

  function initCartPage(root) {
    var elEmpty = root.querySelector('[data-cart-empty]');
    var elContent = root.querySelector('[data-cart-content]');
    var elList = root.querySelector('[data-cart-list]');
    var elTotal = root.querySelector('[data-cart-total]');
    var elSend = root.querySelector('[data-cart-send]');
    var elError = root.querySelector('[data-cart-error]');
    var inName = root.querySelector('#cart-name');
    var inPlace = root.querySelector('#cart-place');
    var products = {};

    function lines() {
      var cart = readCart(), out = [];
      Object.keys(cart).forEach(function (id) {
        var p = products[id];
        var qty = parseInt(cart[id], 10) || 0;
        if (p && qty > 0) out.push({ p: p, qty: Math.min(qty, Math.max(p.stock, 1)) });
      });
      return out;
    }

    function message(ls, total) {
      var out = ['Bonjour Diop Motors, je souhaite commander :'];
      ls.forEach(function (l) { out.push('- ' + l.qty + ' × ' + l.p.name + ' (' + fmt(l.p.price) + ')'); });
      out.push('Total : ' + fmt(total));
      if (inName.value.trim()) out.push('Nom : ' + inName.value.trim());
      if (inPlace.value.trim()) out.push('Livraison ou retrait : ' + inPlace.value.trim());
      return out.join('\n');
    }

    function updateLink() {
      var ls = lines();
      var total = ls.reduce(function (s, l) { return s + l.p.price * l.qty; }, 0);
      elTotal.textContent = fmt(total);
      elSend.href = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(message(ls, total));
    }

    function render() {
      var ls = lines();
      elList.textContent = '';
      elEmpty.hidden = ls.length > 0;
      elContent.hidden = ls.length === 0;
      ls.forEach(function (l) { elList.appendChild(row(l)); });
      updateLink();
      updateBadge();
    }

    function setQty(id, qty) {
      var cart = readCart();
      if (qty <= 0) delete cart[id]; else cart[id] = qty;
      writeCart(cart);
      render();
    }

    function el(tag, cls, text) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    }

    function row(l) {
      var p = l.p;
      var li = el('li', 'card flex gap-4 p-3 sm:p-4 motion-safe:animate-fade-up');
      var thumb = el('div', 'h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-ink-100 sm:h-28 sm:w-28');
      if (p.thumbUrl) {
        var img = document.createElement('img');
        img.src = p.thumbUrl; img.alt = ''; img.className = 'h-full w-full object-cover';
        thumb.appendChild(img);
      } else {
        thumb.appendChild(el('span', 'ph !text-4xl', (p.category || '?').charAt(0)));
      }
      var info = el('div', 'flex min-w-0 flex-1 flex-col');
      var h = el('h3', 'text-lg/tight font-bold normal-case');
      var a = el('a', 'hover:underline', p.name); a.href = p.pageUrl; h.appendChild(a);
      info.appendChild(h);
      info.appendChild(el('span', 'plate mt-2 self-start', fmt(p.price)));

      var ctr = el('div', 'mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-3');
      var qty = el('div', 'inline-flex items-center rounded-xl ring-1 ring-ink-200');
      var minus = el('button', 'h-9 w-9 cursor-pointer rounded-l-xl text-xl font-bold text-ink-700 transition hover:bg-ink-100', '−');
      minus.type = 'button'; minus.setAttribute('aria-label', 'Retirer un ' + p.name);
      var out = el('output', 'min-w-8 text-center font-semibold', String(l.qty));
      var plus = el('button', 'h-9 w-9 cursor-pointer rounded-r-xl text-xl font-bold text-ink-700 transition hover:bg-ink-100', '+');
      plus.type = 'button'; plus.setAttribute('aria-label', 'Ajouter un ' + p.name);
      minus.addEventListener('click', function () { setQty(String(p.id), l.qty - 1); });
      plus.addEventListener('click', function () {
        if (l.qty >= p.stock) { toast('Stock maximum atteint pour ce produit'); return; }
        setQty(String(p.id), l.qty + 1);
      });
      qty.appendChild(minus); qty.appendChild(out); qty.appendChild(plus);
      var rm = el('button', 'cursor-pointer text-sm text-ink-500 underline hover:text-danger-600', 'Retirer'); rm.type = 'button';
      rm.addEventListener('click', function () { setQty(String(p.id), 0); });
      ctr.appendChild(qty); ctr.appendChild(rm);
      ctr.appendChild(el('span', 'ml-auto font-semibold text-ink-900', fmt(p.price * l.qty)));
      info.appendChild(ctr);

      li.appendChild(thumb); li.appendChild(info);
      return li;
    }

    var ids = Object.keys(readCart());
    if (!ids.length) { render(); return; }

    fetch('/api/v1/products?ids=' + encodeURIComponent(ids.join(',')), { headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); })
      .then(function (data) {
        (data.items || []).forEach(function (p) { products[String(p.id)] = p; });
        // Retire du panier les produits retirés du catalogue ou épuisés.
        var cart = readCart(), changed = false;
        Object.keys(cart).forEach(function (id) {
          if (!products[id] || products[id].stock <= 0) { delete cart[id]; changed = true; }
        });
        if (changed) { writeCart(cart); toast('Certains produits ne sont plus disponibles'); }
        render();
      })
      .catch(function () { elError.hidden = false; });

    inName.addEventListener('input', updateLink);
    inPlace.addEventListener('input', updateLink);
    root.querySelector('[data-cart-clear]').addEventListener('click', function () {
      if (window.confirm('Vider le panier ?')) { writeCart({}); render(); }
    });
  }

  /* ---- Photos des formulaires : réduction dans le navigateur, miniatures, aperçu ----
     Une photo de téléphone pèse 3 à 6 Mo. Avant l'envoi, on la réduit à 1600 px (environ
     300 Ko) et on crée une miniature de 480 px. Cela accélère le site et retire aussi les
     métadonnées de la photo (par exemple la position GPS). */
  var photoInput = document.querySelector('[data-photo-input]');
  if (photoInput) initPhotos(photoInput);

  function shrink(file, maxSide, quality) {
    return new Promise(function (resolve) {
      if (!window.createImageBitmap || !/^image\//.test(file.type)) { resolve(null); return; }
      createImageBitmap(file, { imageOrientation: 'from-image' }).then(function (bmp) {
        var scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
        var w = Math.max(1, Math.round(bmp.width * scale));
        var h = Math.max(1, Math.round(bmp.height * scale));
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        var c2d = canvas.getContext('2d');
        c2d.fillStyle = '#fff'; c2d.fillRect(0, 0, w, h);
        c2d.drawImage(bmp, 0, 0, w, h);
        if (bmp.close) bmp.close();
        canvas.toBlob(function (blob) { resolve(blob); }, 'image/jpeg', quality);
      }).catch(function () { resolve(null); });
    });
  }

  function setFiles(input, files) {
    var dt = new DataTransfer();
    files.forEach(function (f) { dt.items.add(f); });
    input.files = dt.files;
  }

  function initPhotos(input) {
    var form = input.form;
    var thumbInput = form.querySelector('[data-thumb-input]');
    var previews = form.querySelector('[data-previews]');
    var warning = form.querySelector('[data-photo-warning]');
    var max = input.multiple ? 6 : 1;
    var busy = null;

    // Si l'envoi est lancé pendant la réduction des photos, on attend la fin.
    form.addEventListener('submit', function (e) {
      if (!busy) return;
      e.preventDefault();
      busy.then(function () { form.requestSubmit(); });
    });

    function showPreviews(files) {
      if (!previews) return;
      previews.textContent = '';
      files.slice(0, max).forEach(function (f) {
        var li = document.createElement('li');
        var img = document.createElement('img');
        img.alt = '';
        img.src = URL.createObjectURL(f);
        img.onload = function () { URL.revokeObjectURL(img.src); };
        li.appendChild(img);
        previews.appendChild(li);
      });
    }

    input.addEventListener('change', function () {
      var files = Array.prototype.slice.call(input.files || []);
      if (warning) warning.hidden = files.length <= max;
      if (thumbInput) { try { setFiles(thumbInput, []); } catch (e) { /* ancien navigateur */ } }
      showPreviews(files.filter(function (f) { return /^image\//.test(f.type); }));
      if (!files.length || files.length > max) return;

      busy = Promise.all(files.map(function (f) {
        return Promise.all([shrink(f, 1600, 0.82), shrink(f, 480, 0.78)]).then(function (res) {
          var base = (f.name || 'photo').replace(/\.[^.]+$/, '');
          return {
            big: res[0] ? new File([res[0]], base + '.jpg', { type: 'image/jpeg' }) : f,
            small: res[1] ? new File([res[1]], 't_' + base + '.jpg', { type: 'image/jpeg' }) : null
          };
        });
      })).then(function (done) {
        try {
          setFiles(input, done.map(function (d) { return d.big; }));
          if (thumbInput && done.every(function (d) { return d.small; })) {
            setFiles(thumbInput, done.map(function (d) { return d.small; }));
          }
          showPreviews(done.map(function (d) { return d.small || d.big; }));
        } catch (e) { /* ancien navigateur : les photos d'origine sont envoyées */ }
      }).catch(function () { /* on envoie les photos d'origine */ })
        .then(function () { busy = null; });
    });
  }

  /* ---- Galerie de la fiche annonce (fondu entre les photos) ---- */
  var main = document.querySelector('[data-main]');
  if (main) {
    document.querySelectorAll('[data-thumb]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (main.getAttribute('src') === b.dataset.thumb) return;
        main.classList.add('opacity-0');
        setTimeout(function () {
          main.src = b.dataset.thumb;
          main.onload = function () { main.classList.remove('opacity-0'); };
          setTimeout(function () { main.classList.remove('opacity-0'); }, 400); // secours
        }, 180);
        document.querySelectorAll('[data-thumb]').forEach(function (o) { o.removeAttribute('aria-current'); });
        b.setAttribute('aria-current', 'true');
      });
    });
  }

  /* ---- Menu mobile ---- */
  var menuBtn = document.querySelector('[data-menu-button]');
  var menu = document.querySelector('[data-menu]');
  if (menuBtn && menu) {
    var setMenu = function (open) {
      menu.classList.toggle('open', open);
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      menuBtn.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
      menuBtn.querySelector('[data-menu-open]').hidden = open;
      menuBtn.querySelector('[data-menu-close]').hidden = !open;
    };
    menuBtn.addEventListener('click', function () { setMenu(!menu.classList.contains('open')); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  }

  /* ---- En-tête : ombre quand on descend dans la page ---- */
  var header = document.querySelector('[data-header]');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---- Apparition des blocs au défilement ---- */
  var reveals = document.querySelectorAll('.reveal');
  document.querySelectorAll('[data-stagger]').forEach(function (group) {
    Array.prototype.forEach.call(group.children, function (child, i) {
      child.style.transitionDelay = Math.min(i, 6) * 70 + 'ms';
    });
  });
  if (reveals.length) {
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      reveals.forEach(function (r) { io.observe(r); });
    } else {
      reveals.forEach(function (r) { r.classList.add('is-in'); });
    }
  }

  /* ---- Confirmation avant suppression ---- */
  document.addEventListener('submit', function (e) {
    var msg = e.target.dataset && e.target.dataset.confirm;
    if (msg && !window.confirm(msg)) e.preventDefault();
  });

  updateBadge();
})();

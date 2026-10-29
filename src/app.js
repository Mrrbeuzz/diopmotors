'use strict';
/** Application : relie le routeur, la sécurité, les pages, l'API et l'admin. */
const http = require('node:http');
const crypto = require('node:crypto');
const config = require('./config');
const { Context, HttpError, serveFile } = require('./lib/http');
const { Router } = require('./lib/router');
const { applySecurityHeaders, RateLimiter } = require('./lib/security');
const { isUploadName } = require('./lib/images');
const { errorPage } = require('./views/info');

const limiter = new RateLimiter();
const router = new Router();

/** Données communes à toutes les pages (admin connecté, jeton CSRF, messages). */
function viewOf(ctx) {
  return {
    path: ctx.path,
    query: ctx.query,
    isAdmin: ctx.session.get('admin') === true,
    csrf: ctx.session.csrf(),
    flashes: ctx.session.takeFlashes(),
  };
}

const deps = { viewOf, limiter };
require('./routes/pages').register(router, deps);
require('./routes/admin').register(router, deps);
require('./routes/api').register(router, deps);

const ERRORS = {
  400: { title: 'Formulaire expiré', message: 'Rechargez la page puis recommencez. Si le problème continue, vérifiez que les cookies sont activés.' },
  404: { title: 'Page introuvable', message: "Cette page n'existe pas ou n'est plus disponible." },
  405: { title: 'Action impossible', message: "Cette adresse n'accepte pas cette action." },
  413: { title: 'Photos trop lourdes', message: `Le total des photos dépasse ${config.maxUploadMb} Mo. Ajoutez moins de photos ou des photos plus légères.` },
  415: { title: 'Formulaire non pris en charge', message: "Le format du formulaire envoyé n'est pas reconnu." },
  429: { title: 'Trop de demandes', message: 'Vous avez fait beaucoup de demandes en peu de temps. Réessayez dans un moment.' },
  500: { title: 'Un problème est survenu', message: 'Réessayez dans un instant.' },
};

function sendError(ctx, res, err) {
  const status = err instanceof HttpError ? err.status : 500;
  if (status === 500) console.error(err);
  if (res.headersSent) { res.destroy(); return; }
  const info = ERRORS[status] || ERRORS[500];
  if (status === 413) res.setHeader('Connection', 'close'); // la suite de l'envoi est ignorée

  if (!ctx) {
    const body = Buffer.from(info.title);
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': body.length });
    res.end(body);
    return;
  }
  if (ctx.path.startsWith('/api/')) return ctx.json({ error: info.title }, status);
  // Les erreurs de page n'écrivent pas dans la session.
  return ctx.html(errorPage(viewOf(ctx), info), status);
}

/** Compare le jeton CSRF reçu à celui de la session. */
function csrfValid(sent, expected) {
  if (!sent || !expected) return false;
  const a = Buffer.from(sent);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function handle(req, res) {
  applySecurityHeaders(res);
  let ctx = null;
  try {
    ctx = new Context(req, res);

    // Fichiers : CSS/JS du site et photos envoyées.
    if (ctx.method === 'GET' || ctx.method === 'HEAD') {
      if (ctx.path.startsWith('/static/')) {
        return await serveFile(ctx, config.publicDir, ctx.path.slice('/static/'.length), { maxAge: 0 });
      }
      if (ctx.path.startsWith('/uploads/')) {
        const name = ctx.path.slice('/uploads/'.length);
        if (!isUploadName(name)) throw new HttpError(404);
        return await serveFile(ctx, config.uploadDir, name, { maxAge: 7 * 86400 });
      }
    }

    const match = router.match(ctx.method, ctx.path);
    if (!match.handler) {
      if (match.allowed.length) {
        res.setHeader('Allow', [...new Set(match.allowed)].join(', '));
        throw new HttpError(405);
      }
      throw new HttpError(404);
    }
    ctx.params = match.params;

    // Protection CSRF de tous les formulaires (l'API publique n'utilise pas de cookie).
    if (ctx.method === 'POST' && !ctx.path.startsWith('/api/')) {
      const form = await ctx.form();
      if (!csrfValid(form.get('_csrf'), ctx.session.get('csrf'))) throw new HttpError(400);
    }

    await match.handler(ctx);
  } catch (err) {
    try {
      sendError(ctx, res, err);
    } catch (inner) {
      console.error(inner);
      res.destroy();
    }
  }
}

/** Serveur HTTP prêt à écouter. */
const createServer = () => http.createServer((req, res) => { handle(req, res); });

module.exports = { createServer, limiter };

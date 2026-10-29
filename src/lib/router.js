'use strict';

/**
 * Routeur minimal. Exemples de chemins :
 *   '/annonces'            chemin fixe
 *   '/annonces/:id(\\d+)'  paramètre numérique
 */
class Router {
  constructor() { this.routes = []; }

  add(method, pattern, handler) {
    const names = [];
    const source = pattern.replace(/:(\w+)(?:\(([^)]+)\))?/g, (_m, name, re) => {
      names.push(name);
      return `(${re || '[^/]+'})`;
    });
    this.routes.push({ method, re: new RegExp(`^${source}$`), names, handler });
    return this;
  }

  get(pattern, handler) { return this.add('GET', pattern, handler); }

  post(pattern, handler) { return this.add('POST', pattern, handler); }

  /** Renvoie { handler, params } ou { allowed: [...] } si le chemin existe avec une autre méthode. */
  match(method, path) {
    const allowed = [];
    for (const route of this.routes) {
      const m = route.re.exec(path);
      if (!m) continue;
      if (route.method === method || (method === 'HEAD' && route.method === 'GET')) {
        const params = {};
        route.names.forEach((n, i) => { params[n] = m[i + 1]; });
        return { handler: route.handler, params };
      }
      allowed.push(route.method);
    }
    return { allowed };
  }
}

module.exports = { Router };

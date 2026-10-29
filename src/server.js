'use strict';
const config = require('./config');

const [major] = process.versions.node.split('.').map(Number);
if (major < 22) {
  console.error(`Node.js ${process.versions.node} est trop ancien : installez Node.js 22 ou plus récent (nodejs.org).`);
  process.exit(1);
}

const db = require('./db');
const { createServer } = require('./app');

/** Message clair quand la base n'est pas joignable. */
function explainDatabaseError(err) {
  const where = config.databaseUrl.replace(/:\/\/([^:@/]+):[^@]*@/, '://$1:***@');
  console.error(`\nImpossible de se connecter à PostgreSQL (${where}).`);
  if (err.code === 'ECONNREFUSED') {
    console.error("Le serveur PostgreSQL n'est pas démarré, ou l'adresse / le port est faux. Voir le README, section 1 (Installer).");
  } else if (err.code === '28P01' || err.code === '28000') {
    console.error('Utilisateur ou mot de passe incorrect. Vérifiez DATABASE_URL dans le fichier .env.');
  } else if (err.code === '3D000') {
    console.error("La base n'existe pas. Créez-la (voir le README), puis relancez.");
  } else {
    console.error(err.message);
  }
}

async function main() {
  try {
    await db.init();
  } catch (err) {
    explainDatabaseError(err);
    process.exit(1);
  }

  const server = createServer();

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Le port ${config.port} est déjà utilisé. Fermez l'autre programme ou changez PORT dans le fichier .env.`);
    } else {
      console.error(err);
    }
    process.exit(1);
  });

  server.listen(config.port, config.host, () => {
    const where = config.host === '0.0.0.0' ? 'toutes les adresses de cet ordinateur' : config.host;
    console.log(`${config.siteName} : http://${config.host === '0.0.0.0' ? '127.0.0.1' : config.host}:${config.port}  (écoute sur ${where})`);
    if (config.adminPassword === 'changeme') {
      console.log('Attention : le mot de passe admin est celui par défaut. Changez ADMIN_PASSWORD dans .env.');
    }
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      server.close(() => db.close().finally(() => process.exit(0)));
      server.closeIdleConnections?.();
    });
  }
}

main();

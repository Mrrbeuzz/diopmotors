'use strict';
/**
 * Enregistrement des photos envoyées.
 *
 * Le navigateur réduit déjà chaque photo (1600 px) et crée une miniature avant l'envoi
 * (voir public/js/app.js). Ici, on vérifie que le fichier est bien une image JPG, PNG ou
 * WebP (par son contenu, pas par son nom), on limite son poids, et on lui donne un nom
 * aléatoire.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');

const NAME_RE = /^[a-f0-9]{32}\.(jpg|png|webp)$/;
const MAX_THUMB_BYTES = 1.5 * 1024 * 1024;

/** Type réel de l'image d'après ses premiers octets, ou null. */
function sniff(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

const thumbName = (name) => 't_' + name;

/**
 * Enregistre une photo (et sa miniature si elle est fournie).
 * Renvoie { name } ou { error: 'invalid' | 'toolarge' }.
 */
async function saveUpload(file, thumbFile) {
  if (file.size > config.maxFileMb * 1024 * 1024) return { error: 'toolarge' };
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniff(buf);
  if (!ext) return { error: 'invalid' };

  // Miniature : celle du navigateur si elle est valide et du même type, sinon la photo elle-même.
  let thumbBuf = buf;
  if (thumbFile && thumbFile.size <= MAX_THUMB_BYTES) {
    const candidate = Buffer.from(await thumbFile.arrayBuffer());
    if (sniff(candidate) === ext) thumbBuf = candidate;
  }

  const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
  await fs.promises.writeFile(path.join(config.uploadDir, name), buf, { flag: 'wx' });
  await fs.promises.writeFile(path.join(config.uploadDir, thumbName(name)), thumbBuf, { flag: 'wx' });
  return { name };
}

/** Supprime une photo et sa miniature. */
function removeUpload(name) {
  if (!name || !NAME_RE.test(name)) return;
  for (const file of [name, thumbName(name)]) {
    try { fs.unlinkSync(path.join(config.uploadDir, file)); } catch { /* déjà supprimée */ }
  }
}

/** Nom de fichier autorisé pour le service des photos (photo ou miniature). */
const isUploadName = (name) => NAME_RE.test(name.replace(/^t_/, ''));

module.exports = { saveUpload, removeUpload, thumbName, isUploadName, sniff };

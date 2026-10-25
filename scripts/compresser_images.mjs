#!/usr/bin/env node
// Compresse sur place les images lourdes d'un dossier (par défaut public/),
// SANS changer leurs noms ni leurs formats : aucun lien du site ne bouge.
// Largeur limitée à 1600 px ; un fichier n'est remplacé que s'il gagne > 5 %.
// Usage (à la racine du projet, sharp doit être installé — c'est le cas avec Next.js) :
//   node "<dossier du skill>/scripts/compresser_images.mjs" [dossier=public] [seuil_ko=300]
// Leçon iziVoice 13/10/2026 : 24 images, 23,5 Mo → 4,1 Mo, sans perte visible.
// Contrôler à l'œil au moins un logo, une photo et une illustration après coup.
import { createRequire } from 'node:module';
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';

const sharp = createRequire(resolve('package.json'))('sharp');
const root = resolve(process.argv[2] || 'public');
const thresholdKo = Number(process.argv[3] || 300);
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else if (/\.(png|jpe?g|webp)$/i.test(name) && stat.size > thresholdKo * 1024) files.push(path);
  }
})(root);

let before = 0, after = 0;
for (const file of files) {
  const input = readFileSync(file);
  const ext = extname(file).toLowerCase();
  let image = sharp(input).rotate();
  const { width = 0 } = await image.metadata();
  if (width > 1600) image = image.resize({ width: 1600, withoutEnlargement: true });
  const output = ext === '.png'
    ? await image.png({ compressionLevel: 9, palette: true, quality: 85, effort: 10 }).toBuffer()
    : ext === '.webp'
      ? await image.webp({ quality: 78, effort: 6 }).toBuffer()
      : await image.jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  before += input.length;
  const rel = file.replace(root + '/', '');
  if (output.length < input.length * 0.95) {
    writeFileSync(file, output);
    after += output.length;
    console.log(`${Math.round(input.length / 1024)} Ko -> ${Math.round(output.length / 1024)} Ko  ${rel}`);
  } else {
    after += input.length;
    console.log(`inchangé  ${rel}`);
  }
}
console.log(`${files.length} image(s) > ${thresholdKo} Ko : ${(before / 1048576).toFixed(1)} Mo -> ${(after / 1048576).toFixed(1)} Mo`);

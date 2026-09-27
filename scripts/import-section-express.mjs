#!/usr/bin/env node
/**
 * Importa o pack Section Express (.zip) para data/section-express/, que o
 * /playground lê direto, sem WordPress.
 *
 *   npm run sections:import -- "C:\Users\voce\Downloads\3500-sections.zip"
 *
 * Abre os zips internos (seções com loop, popups), copia cada JSON sem alterar
 * e gera index.json com o tipo e os widgets de cada item, para a biblioteca
 * filtrar sem precisar abrir os 3.500 arquivos.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT_DIR = path.resolve(import.meta.dirname, '..', 'data', 'section-express');
const FOLDER = { section: 'sections', loop: 'loops', popup: 'popups' };

// Lê um .zip da memória: só o necessário para este pack (stored/deflate, sem ZIP64).
const readZip = (buf) => {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('não é um arquivo .zip');

  const entries = [];
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = buf.readUInt16LE(eocd + 10); n > 0; n--) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('diretório do zip corrompido');
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const skip = nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString(flags & 0x800 ? 'utf8' : 'latin1', p + 46, p + 46 + nameLen);
    p += 46 + skip;
    if (name.endsWith('/')) continue;

    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    entries.push({
      name,
      read: () => {
        if (method === 0) return raw;
        if (method === 8) return zlib.inflateRawSync(raw);
        throw new Error(`${name}: compressão ${method} não suportada`);
      },
    });
  }
  return entries;
};

const elementsOf = (doc) =>
  Array.isArray(doc) ? doc : Array.isArray(doc?.content) ? doc.content : Array.isArray(doc?.elements) ? doc.elements : [];

const countWidgets = (elements, counts = {}) => {
  for (const el of elements) {
    if (!el || typeof el !== 'object') continue;
    if (el.elType === 'widget' && el.widgetType) counts[el.widgetType] = (counts[el.widgetType] || 0) + 1;
    if (Array.isArray(el.elements)) countWidgets(el.elements, counts);
  }
  return counts;
};

const kindOf = (doc, id) => {
  if (doc?.type === 'loop-item' || /-loop$/.test(id)) return 'loop';
  if (doc?.type === 'popup') return 'popup';
  return 'section';
};

const zipPath = process.argv[2];
if (!zipPath) {
  console.error('Uso: npm run sections:import -- <caminho do .zip do Section Express>');
  process.exit(1);
}

const items = new Map();
const skipped = [];

const walk = (entries, where) => {
  for (const entry of entries) {
    const base = path.posix.basename(entry.name.replace(/\\/g, '/'));
    if (/\.zip$/i.test(base)) {
      walk(readZip(entry.read()), `${where} > ${base}`);
      continue;
    }
    if (!/\.json$/i.test(base)) continue;

    const id = base.replace(/\.json$/i, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    const bytes = entry.read();
    let doc;
    try {
      doc = JSON.parse(bytes.toString('utf8'));
    } catch (error) {
      skipped.push(`${where} > ${base}: JSON inválido (${error.message})`);
      continue;
    }
    if (items.has(id)) {
      skipped.push(`${where} > ${base}: id "${id}" repetido`);
      continue;
    }
    const kind = kindOf(doc, id);
    items.set(id, { id, kind, doc, bytes });
  }
};

walk(readZip(fs.readFileSync(zipPath)), path.basename(zipPath));

const order = { section: 0, loop: 0, popup: 1 };
const num = (id) => Number(id.match(/\d+/)?.[0] ?? Infinity);
const sorted = [...items.values()].sort(
  (a, b) => order[a.kind] - order[b.kind] || num(a.id) - num(b.id) || a.id.localeCompare(b.id),
);

fs.rmSync(OUT_DIR, { recursive: true, force: true });
for (const folder of Object.values(FOLDER)) fs.mkdirSync(path.join(OUT_DIR, folder), { recursive: true });

const entries = sorted.map(({ id, kind, doc, bytes }) => {
  const file = `${FOLDER[kind]}/${id}.json`;
  fs.writeFileSync(path.join(OUT_DIR, file), bytes);
  return {
    id,
    kind,
    type: doc?.type ?? null,
    title: typeof doc?.title === 'string' ? doc.title : id,
    file,
    bytes: bytes.length,
    widgets: countWidgets(elementsOf(doc)),
    ...(kind === 'loop' ? { parent: id.replace(/-loop$/, '') } : {}),
  };
});

fs.writeFileSync(
  path.join(OUT_DIR, 'index.json'),
  JSON.stringify({ source: path.basename(zipPath), importedAt: new Date().toISOString(), entries }),
);

const count = (kind) => entries.filter((e) => e.kind === kind).length;
console.log(`Importado para ${path.relative(process.cwd(), OUT_DIR)}:`);
console.log(`  ${count('section')} seções, ${count('loop')} templates de loop, ${count('popup')} popups`);
if (skipped.length) {
  console.log(`  ${skipped.length} arquivo(s) ignorado(s):`);
  for (const line of skipped) console.log(`   - ${line}`);
}

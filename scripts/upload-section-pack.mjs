#!/usr/bin/env node
/**
 * Envia data/section-express/ para o bucket privado `section-pack` do
 * Supabase, de onde o app publicado lê a biblioteca (só para quem está logado).
 *
 *   npm run sections:upload
 *
 * Precisa da chave service_role em SUPABASE_SERVICE_ROLE_KEY, no ambiente ou
 * em .env.local (o git ignora). Nunca coloque essa chave num VITE_ nem no .env
 * versionado: ela ignora o RLS. O bucket vem da migração
 * supabase/migrations/20260928210000_section_pack_bucket.sql.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(import.meta.dirname, '..');
const PACK_DIR = path.join(ROOT, 'data', 'section-express');
const BUCKET = 'section-pack';
const PARALLEL = 8;

for (const file of ['.env.local', '.env']) {
  const p = path.join(ROOT, file);
  if (fs.existsSync(p)) process.loadEnvFile(p);
}

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY (Supabase > Project Settings > API Keys) no .env.local.');
  process.exit(1);
}
if (!fs.existsSync(path.join(PACK_DIR, 'index.json'))) {
  console.error('Não há pack em data/section-express. Rode antes: npm run sections:import -- "caminho/do/pack.zip"');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { error: bucketError } = await supabase.storage.getBucket(BUCKET);
if (bucketError) {
  console.error(`O bucket "${BUCKET}" não existe (${bucketError.message}). Aplique a migração 20260928210000_section_pack_bucket.sql.`);
  process.exit(1);
}

const upload = async (file) => {
  const body = fs.readFileSync(path.join(PACK_DIR, file));
  for (let attempt = 1; ; attempt++) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(file, body, { contentType: 'application/json', cacheControl: '3600', upsert: true });
    if (!error) return;
    if (attempt === 3) throw new Error(`${file}: ${error.message}`);
    await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
  }
};

const queue = ['sections', 'loops', 'popups'].flatMap((dir) =>
  fs.existsSync(path.join(PACK_DIR, dir))
    ? fs.readdirSync(path.join(PACK_DIR, dir)).filter((f) => f.endsWith('.json')).map((f) => `${dir}/${f}`)
    : [],
);
const total = queue.length;
const failed = [];
let done = 0;

console.log(`Enviando ${total} arquivos para ${BUCKET}…`);
await Promise.all(
  Array.from({ length: PARALLEL }, async () => {
    for (let file = queue.shift(); file; file = queue.shift()) {
      try {
        await upload(file);
      } catch (error) {
        failed.push(error.message);
      }
      if (++done % 250 === 0) console.log(`${done}/${total}`);
    }
  }),
);

if (failed.length) {
  console.error(`${failed.length} arquivos falharam; o índice não foi trocado. Rode de novo.`);
  for (const message of failed.slice(0, 10)) console.error(`  ${message}`);
  process.exit(1);
}

// O índice vai por último: o app só enxerga as seções novas quando todas já estão lá
await upload('index.json');
console.log(`Pronto: ${total} arquivos + index.json no bucket ${BUCKET}.`);

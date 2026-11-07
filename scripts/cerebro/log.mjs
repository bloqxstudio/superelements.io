// npm run cerebro:log -- <iniciativa> "Título do que aconteceu"
// Cria cerebro/<iniciativa>/log/AAAA-MM-DD-titulo.md a partir do modelo e mostra o caminho.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { RAIZ, exigirIniciativa, hoje, slug } from './comum.mjs';

const [iniciativa, ...resto] = process.argv.slice(2);
const titulo = resto.join(' ').trim();
const pasta = exigirIniciativa(iniciativa);
if (!titulo) {
  console.error('Falta o título: npm run cerebro:log -- <iniciativa> "Título"');
  process.exit(1);
}

const data = hoje();
const dir = join(pasta, 'log');
mkdirSync(dir, { recursive: true });
let arquivo = join(dir, `${data}-${slug(titulo)}.md`);
for (let n = 2; existsSync(arquivo); n++) arquivo = join(dir, `${data}-${slug(titulo)}-${n}.md`);

const modelo = readFileSync(join(RAIZ, '_modelos', 'log.md'), 'utf8');
writeFileSync(arquivo, modelo.replaceAll('{{data}}', data).replaceAll('{{titulo}}', titulo).replaceAll('{{iniciativa}}', iniciativa));
console.log(relative(process.cwd(), arquivo));

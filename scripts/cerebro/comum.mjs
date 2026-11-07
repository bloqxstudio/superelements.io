// Caminhos e utilidades do segundo cérebro (pasta cerebro/).
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'cerebro');

// "geral" é o que atravessa tudo (cerebro/geral/); as outras são as pastas de cerebro/iniciativas/
// (frentes da empresa) e de cerebro/clientes/ (uma por cliente). Os nomes não se repetem entre as duas.
const pastas = (grupo) => {
  const dir = join(RAIZ, grupo);
  return existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort() : [];
};

export function pastaDa(nome) {
  if (nome === 'geral') return join(RAIZ, 'geral');
  if (pastas('clientes').includes(nome)) return join(RAIZ, 'clientes', nome);
  return join(RAIZ, 'iniciativas', nome);
}

export function iniciativas() {
  return ['geral', ...pastas('iniciativas'), ...pastas('clientes')];
}

export function exigirIniciativa(iniciativa) {
  const todas = iniciativas();
  if (!iniciativa || !todas.includes(iniciativa)) {
    console.error(`Iniciativa desconhecida: ${iniciativa ?? '(vazia)'}\nUse uma destas: ${todas.join(', ')}\nPara uma nova, copie cerebro/_modelos/iniciativa.md (ou cliente.md) para cerebro/iniciativas/<nome>/ ou cerebro/clientes/<nome>/ como README.md.`);
    process.exit(1);
  }
  return pastaDa(iniciativa);
}

export function slug(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'sem-titulo';
}

// Data de São Paulo, para o nome do arquivo não virar o dia seguinte à noite.
export function hoje() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

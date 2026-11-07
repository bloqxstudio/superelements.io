// npm run cerebro:midia -- <iniciativa> <arquivo> [mais arquivos] [--nome nome-curto]
// Copia imagens, vídeos e PDFs para cerebro/<iniciativa>/midia/AAAA-MM/, já leves para o Git:
// imagem → WebP de até 1600 px; vídeo → MP4 H.264 de até 1280 px; PDF e GIF vão como estão.
// Mostra o Markdown para colar numa nota (README) e num log.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs';
import { basename, extname, join, relative } from 'node:path';
import { exigirIniciativa, hoje, slug } from './comum.mjs';

const args = process.argv.slice(2);
const iNome = args.indexOf('--nome');
const nome = iNome >= 0 ? args.splice(iNome, 2)[1] : null;
const [iniciativa, ...arquivos] = args;
const pasta = exigirIniciativa(iniciativa);
if (!arquivos.length) {
  console.error('Falta o arquivo: npm run cerebro:midia -- <iniciativa> <arquivo> [--nome nome-curto]');
  process.exit(1);
}

const IMAGEM = new Set(['.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif', '.tif', '.tiff', '.bmp']);
const VIDEO = new Set(['.mp4', '.mov', '.webm', '.m4v', '.mkv']);
const COPIA = new Set(['.pdf', '.gif', '.svg']);
const AVISO = 15 * 1024 * 1024; // passa disso: pense em cortar o vídeo
const LIMITE = 50 * 1024 * 1024; // o GitHub avisa a partir de 50 MB e recusa 100 MB

const mes = hoje().slice(0, 7);
const destino = join(pasta, 'midia', mes);
mkdirSync(destino, { recursive: true });
const ffmpeg = (...a) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: 'inherit' });
const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;

arquivos.forEach((origem, i) => {
  if (!existsSync(origem)) return console.error(`Não achei: ${origem}`);
  const ext = extname(origem).toLowerCase();
  const base = slug(nome ? (arquivos.length > 1 ? `${nome}-${i + 1}` : nome) : basename(origem, extname(origem)));
  let saida;
  if (IMAGEM.has(ext)) {
    saida = join(destino, `${base}.webp`);
    ffmpeg('-i', origem, '-vf', "scale='min(1600,iw)':-2", '-frames:v', '1', '-quality', '82', saida);
  } else if (VIDEO.has(ext)) {
    saida = join(destino, `${base}.mp4`);
    ffmpeg('-i', origem, '-vf', "scale='min(1280,iw)':-2", '-c:v', 'libx264', '-crf', '28', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', saida);
  } else if (COPIA.has(ext)) {
    saida = join(destino, `${base}${ext}`);
    copyFileSync(origem, saida);
  } else {
    return console.error(`Tipo não aceito (${ext}): ${origem}. Imagens, vídeos, PDF, GIF ou SVG.`);
  }
  const tamanho = statSync(saida).size;
  if (tamanho > LIMITE) {
    unlinkSync(saida);
    return console.error(`${basename(origem)} ficou com ${mb(tamanho)}: grande demais para o Git. Corte o vídeo ou guarde fora e ponha o link na nota.`);
  }
  const daNota = relative(pasta, saida);
  const doLog = relative(join(pasta, 'log'), saida);
  const md = (p) => (VIDEO.has(ext) || ext === '.pdf' ? `[${base}](${p})` : `![${base}](${p})`);
  console.log(`${relative(process.cwd(), saida)} · ${mb(tamanho)}${tamanho > AVISO ? ' (pesado: corte se puder)' : ''}`);
  console.log(`  na nota: ${md(daNota)}`);
  console.log(`  no log:  ${md(doLog)}`);
});

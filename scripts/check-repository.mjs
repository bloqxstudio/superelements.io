import { execFileSync } from 'node:child_process';

// Inspect the index so this can run before committing, without reading local secrets.
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const generated = /^(?:\.tmp(?:-[^/]+)?|tmp|work|outputs|node_modules|dist|coverage|playwright-report|test-results|\.shipstudio|\.space|\.codex)\//;
const media = /^artifacts\/.*\.(?:png|jpe?g|webp|gif|mp4|mov|webm)$/i;
const localConfig = /^\.env(?:\..+)?$/;
const problems = files.filter((file) => generated.test(file) || media.test(file) || (localConfig.test(file) && file !== '.env.example') || ['bun.lock', 'bun.lockb', 'sp3.mp4'].includes(file) || /(?:^|\/)__pycache__\//.test(file) || /\.(?:pyc|pyo|tsbuildinfo)$/.test(file));
if (problems.length) {
  console.error('Arquivos locais ou gerados no índice Git:\n' + problems.map((file) => `  ${file}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Repositório verificado: ${files.length} arquivos; nenhum temporário, configuração local ou mídia gerada no índice.`);
}

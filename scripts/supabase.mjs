import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { query, project } from './supabase-api.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const [command, ...args] = process.argv.slice(2);
const config = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8');
if (!config.match(/^project_id\s*=\s*"nfmfcpcwyavutntnrxqq"/m)) throw new Error('Destino diferente do SuperElements.');
const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
function cli(options) {
  const result = spawnSync('supabase', [...options, '--project-ref', project, '--workdir', root], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
function migrations() {
  return readdirSync(new URL('../supabase/migrations/', import.meta.url)).sort().filter((name) => /^\d{14}_.+\.sql$/.test(name)).map((file) => {
    const sql = readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8');
    return { file, sql, version: file.slice(0, 14), name: file.slice(15, -4), sha256: createHash('sha256').update(sql).digest('hex') };
  });
}
function plan() {
  const baseline = JSON.parse(readFileSync(new URL('../supabase/migration-baseline.json', import.meta.url), 'utf8'));
  if (baseline.project !== project) throw new Error('Baseline de outro projeto.');
  const history = query('select version, name from supabase_migrations.schema_migrations order by version');
  const applied = new Set(history.map((row) => row.version));
  const files = migrations();
  for (const entry of files) {
    if (baseline.files[entry.file] && baseline.files[entry.file] !== entry.sha256) throw new Error(`Migração anterior ao baseline foi alterada: ${entry.file}. Crie uma nova migração.`);
  }
  const pending = files.filter((entry) => !baseline.files[entry.file] && !applied.has(entry.version));
  const latest = [baseline.cutoff, ...history.map((row) => row.version)].sort().at(-1);
  if (pending.some((entry) => entry.version <= latest)) throw new Error('Migração nova com data anterior ao estado atual. Crie uma migração com timestamp atual; não reaplique arquivos antigos.');
  console.log(`Projeto: ${project}. Baseline legado: ${Object.keys(baseline.files).length} arquivos. Histórico remoto: ${history.length}.`);
  console.log(pending.length ? pending.map((entry) => entry.file).join('\n') : 'Nenhuma migração nova pendente.');
  return pending;
}
try {
  switch (command) {
    case 'status':
      console.log(JSON.stringify(query('select current_database() as database, current_user as role'), null, 2));
      plan();
      cli(['functions', 'list']);
      break;
    case 'plan': plan(); break;
    case 'migrate':
      for (const entry of plan()) {
        query(`begin; select pg_advisory_xact_lock(742688104);\n${entry.sql}\ninsert into supabase_migrations.schema_migrations(version,name,statements) values (${quote(entry.version)},${quote(entry.name)},array[${quote(entry.sql)}]); commit;`);
        console.log(`Aplicada: ${entry.file}`);
      }
      break;
    case 'query': {
      const sql = args.length === 2 && args[0] === '--file' ? readFileSync(args[1], 'utf8') : args.length === 1 ? args[0] : null;
      if (!sql) throw new Error('Use db:query -- "select ..." ou db:query -- --file caminho.sql');
      console.log(JSON.stringify(query(sql), null, 2));
      break;
    }
    case 'deploy':
      if (!args.length || args.some((name) => !/^[a-z][a-z0-9-]*$/.test(name))) throw new Error('Informe os nomes: functions:deploy -- instagram meta-ads');
      for (const name of args) cli(['functions', 'deploy', name, '--use-api']);
      break;
    default: throw new Error('Comandos: status, plan, migrate, query, deploy.');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

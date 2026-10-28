import { spawnSync } from 'node:child_process';

export const project = 'nfmfcpcwyavutntnrxqq';
let credential;
function token() {
  if (credential) return credential;
  if (process.env.SUPABASE_ACCESS_TOKEN) return credential = process.env.SUPABASE_ACCESS_TOKEN;
  const result = spawnSync('/usr/bin/security', ['find-generic-password', '-s', 'Supabase CLI', '-a', 'supabase', '-w'], { encoding: 'utf8', timeout: 60000 });
  if (result.status !== 0) throw new Error('Autorize o acesso à credencial Supabase CLI no Chaves do macOS.');
  credential = result.stdout.trim();
  if (!credential.startsWith('sbp_')) throw new Error('Credencial Supabase inválida. Execute supabase login.');
  return credential;
}

export function api(path, body, method = 'POST') {
  if (!path.startsWith('/database/')) throw new Error('Este cliente opera somente a API de banco do SuperElements.');
  const config = [
    `url = ${JSON.stringify(`https://api.supabase.com/v1/projects/${project}${path}`)}`,
    `request = ${JSON.stringify(method)}`,
    `header = ${JSON.stringify(`Authorization: Bearer ${token()}`)}`,
    'header = "Content-Type: application/json"',
    ...(body === undefined ? [] : [`data = ${JSON.stringify(JSON.stringify(body))}`]),
  ].join('\n');
  const result = spawnSync('/usr/bin/curl', ['--silent', '--show-error', '--fail-with-body', '--max-time', '120', '--config', '-'], { input: config, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 125000 });
  if (result.status !== 0) throw new Error((result.stdout || result.stderr || 'Falha na API Supabase.').replaceAll(credential, '[credencial oculta]'));
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}

export const query = (sql) => api('/database/query', { query: sql });

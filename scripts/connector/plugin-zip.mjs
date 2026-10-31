// Monta public/wordpress/superelements-connector.zip: o plugin mais o script de visitas (public/visitas.js)
import { cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const work = mkdtempSync(join(tmpdir(), 'se-plugin-'))
const dir = join(work, 'superelements-connector')
try {
  cpSync(join(root, 'wordpress-plugin/superelements-connector'), dir, { recursive: true })
  mkdirSync(join(dir, 'assets'), { recursive: true })
  cpSync(join(root, 'public/visitas.js'), join(dir, 'assets/visitas.js'))
  const out = join(root, 'public/wordpress/superelements-connector.zip')
  rmSync(out, { force: true })
  execFileSync('zip', ['-rq', out, 'superelements-connector'], { cwd: work })
  console.log('ok', out)
} finally {
  rmSync(work, { recursive: true, force: true })
}

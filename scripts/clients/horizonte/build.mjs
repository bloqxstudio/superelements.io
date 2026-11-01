/** Code-only authoring: pull the latest page, run this, then push the native sections. */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { refineArchitectureSection } from '../../../src/features/avence/arquitetura/refine.mjs';

const directory = path.resolve(process.argv[2] || '.space/avence-case-arquitetura-exemplo/teste');
const backup = path.join(directory, 'before-refinement');
mkdirSync(backup, { recursive: true });
for (const filename of readdirSync(directory).filter(name => /^\d.*\.json$/.test(name))) {
  const file = path.join(directory, filename);
  if (!existsSync(path.join(backup, filename))) copyFileSync(file, path.join(backup, filename), 1);
  const section = JSON.parse(readFileSync(file, 'utf8'));
  writeFileSync(file, JSON.stringify(refineArchitectureSection(section), null, 2) + '\n');
  console.log(`Refinado: ${filename}`);
}

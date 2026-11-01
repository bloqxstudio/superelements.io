import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { refineCase2, case2Images } from '../../../src/features/avence/arquitetura/case2.mjs';

const project = '.space/avence-case-arquitetura-exemplo';
const directory = path.join(project, 'case-2');
const backup = path.join(directory, 'before-exclusive-images');
fs.mkdirSync(backup, { recursive: true });
const urls = [];
const ids = nodes => nodes.flatMap(node => [node.id, ...ids(node.elements || [])]);
for (const file of fs.readdirSync(directory).filter(name => /^\d.*\.json$/.test(name))) {
  const target = path.join(directory, file);
  if (!fs.existsSync(path.join(backup, file))) fs.copyFileSync(target, path.join(backup, file));
  const original = JSON.parse(fs.readFileSync(target, 'utf8'));
  const refined = refineCase2(original);
  assert.deepEqual(ids(original.elements).filter(id => id !== 'tqproccontrols'), ids(refined.elements).filter(id => id !== 'tqproccontrols'));
  assert.deepEqual(refineCase2(refined), refined);
  function walk(node) {
    if (node.settings?.image?.url) urls.push(node.settings.image.url);
    for (const child of node.elements || []) walk(child);
  }
  refined.elements.forEach(walk);
  fs.writeFileSync(target, JSON.stringify(refined, null, 2) + '\n');
}
assert.equal(urls.length, Object.keys(case2Images).length);
assert.equal(new Set(urls).size, urls.length, 'Repeated image in Case 2');
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const hashes = urls.map(url => hash('public' + url));
assert.equal(new Set(hashes).size, hashes.length, 'Repeated image contents');
const firstUrls = new Set();
function collect(node) {
  if (node.settings?.image?.url) firstUrls.add(node.settings.image.url);
  for (const match of (node.settings?.html || '').matchAll(/src=["']([^"']+)["']/g)) if (match[1].startsWith('/')) firstUrls.add(match[1]);
  for (const child of node.elements || []) collect(child);
}
for (const file of fs.readdirSync(path.join(project, 'teste')).filter(name => /^\d.*\.json$/.test(name))) {
  JSON.parse(fs.readFileSync(path.join(project, 'teste', file), 'utf8')).elements.forEach(collect);
}
for (const url of firstUrls) {
  assert(!urls.includes(url), 'Shared image URL with the first case: ' + url);
  assert(!hashes.includes(hash('public' + url)), 'Shared image contents with the first case: ' + url);
}
console.log(`Case 2 generated: 7 sections, ${urls.length} unique images, zero shared images with teste, IDs preserved, generation idempotent.`);

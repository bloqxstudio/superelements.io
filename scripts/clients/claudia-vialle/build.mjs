import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {personalize} from '../../../src/features/claudiavialle/personalize.mjs';
const project='.space/avence-case-arquitetura-exemplo';
const all=[];
for(const [variant,source,target] of [['editorial','teste','claudia-vialle-editorial'],['case2','case-2','claudia-vialle-case-2']]){
 const output=path.join(project,target);fs.mkdirSync(output,{recursive:true});
 const images=[];
 for(const file of fs.readdirSync(path.join(project,source)).filter(f=>/^\d.*\.json$/.test(f))){
  const section=personalize(JSON.parse(fs.readFileSync(path.join(project,source,file))),variant);
  const previous=path.join(output,file);
  if(fs.existsSync(previous)){const saved=JSON.parse(fs.readFileSync(previous));if(saved.id)section.id=saved.id;}
  function visit(n){if(n.widgetType==='image'){assert(n.settings.image.url.startsWith('/brands/claudia-vialle/'));images.push(n.settings.image.url)}for(const c of n.elements||[])visit(c)}section.elements.forEach(visit);
  fs.writeFileSync(path.join(output,file),JSON.stringify(section,null,2)+'\n');
 }
 assert.equal(images.length,new Set(images).size,'Repeated photos in '+variant);
 for(const url of images){assert(fs.existsSync('public'+url),url);assert(!all.includes(url),'Repeated photo between proposals: '+url);all.push(url)}
 console.log(variant+': '+images.length+' exclusive real photographs; original pages unchanged.');
}
assert.equal(all.length,16);

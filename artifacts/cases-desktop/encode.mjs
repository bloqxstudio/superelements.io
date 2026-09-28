import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
const root=path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const name=process.argv[2];
if(!['junior','processbase'].includes(name)) throw Error('Escolha junior ou processbase');
const folder=path.join(root,name+'-take');
const frames=JSON.parse(await fs.readFile(path.join(folder,'timing.json'),'utf8'));
const end=frames.at(-1).time;
// Retira o carregamento inicial. Mantém os intervalos reais entre os quadros.
const used=frames.filter(f=>f.time>=frames[0].time+2200&&f.time<=end-1200);
let concat='ffconcat version 1.0\n';
for(let i=0;i<used.length;i++){
  concat+=`file '${used[i].file}'\nduration ${((used[i+1]?.time??used[i].time+150)-used[i].time)/1000}\n`;
}
concat+=`file '${used.at(-1).file}'\n`;
await fs.writeFile(path.join(folder,'frames.ffconcat'),concat);
const output=path.join(root,name+'-desktop.mp4');
const args=['-y','-hide_banner','-loglevel','warning','-safe','0','-f','concat','-i',path.join(folder,'frames.ffconcat'),'-vf','scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0B0B0C,fps=30','-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',output];
const proc=spawn('ffmpeg',args,{stdio:'inherit',windowsHide:true});
await new Promise((resolve,reject)=>{proc.on('error',reject);proc.on('close',code=>code===0?resolve():reject(Error('FFmpeg '+code)))});
console.log(output);

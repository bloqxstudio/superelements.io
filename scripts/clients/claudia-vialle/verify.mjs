import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
const fail = message => {throw new Error(message)};
const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
]

async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = () => reject(new Error('CDP não abriu'))
  })
  let next = 0
  const waiting = new Map()
  const listeners = new Map()
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data)
    if (message.id && waiting.has(message.id)) {
      const { resolve, reject } = waiting.get(message.id)
      waiting.delete(message.id)
      message.error ? reject(new Error(message.error.message)) : resolve(message.result)
    } else if (message.method) listeners.get(message.method)?.forEach((fn) => fn(message.params))
  }
  return {
    send: (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = ++next
        waiting.set(id, { resolve, reject })
        ws.send(JSON.stringify({ id, method, params }))
      }),
    once: (method) => new Promise((resolve) => listeners.set(method, [...(listeners.get(method) ?? []), resolve])),
    close: () => ws.close(),
  }
}

/** Abre o Edge (ou o Chrome) headless, entrega a aba pelo CDP e fecha tudo no fim. */
async function withBrowser(work) {
  const browser = BROWSERS.find((b) => existsSync(b))
  if (!browser) fail('Não achei o Edge nem o Chrome para abrir a página')
  const port = 9400 + Math.floor(Math.random() * 400)
  const profile = mkdtempSync(path.join(os.tmpdir(), 'space-shot-'))
  const args = ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--force-color-profile=srgb', 'about:blank']
  const child = spawn(browser, args, { stdio: 'ignore' })
  try {
    let targets
    for (let i = 0; i < 50 && !targets; i++) {
      await new Promise((r) => setTimeout(r, 200))
      targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()).catch(() => null)
    }
    const page = targets?.find((t) => t.type === 'page')
    if (!page) throw new Error('O navegador headless não abriu')
    const tab = await cdp(page.webSocketDebuggerUrl)
    try {
      return await work(tab)
    } finally {
      tab.close()
    }
  } finally {
    child.kill()
    await new Promise((r) => setTimeout(r, 300))
    rmSync(profile, { recursive: true, force: true, maxRetries: 3 })
  }
}

const directory=path.resolve(process.argv[2]||'artifacts/claudia-vialle');
mkdirSync(directory,{recursive:true});
const bridge=JSON.parse(readFileSync('.space/bridge.json','utf8'));
const status=JSON.parse(readFileSync('.space/claudia-status.json','utf8'));
const reports=[];
for(const [variant,pageName,selectors] of [
 ['editorial','Claudia Vialle · Editorial',['.kn-hero','.kn-about','.kn-projects','.kn-footer']],
 ['case2','Claudia Vialle · Case 2',['.tq-hero','.tq-studio','.tq-projects','.tq-proc','.tq-footer']],
]){
 const page=status.pages.find(p=>p.name===pageName);if(!page)throw new Error(pageName+' not found');
 for(const [device,width,height] of [['desktop',1440,900],['mobile',390,844]]){
  const query=new URLSearchParams({token:bridge.token,project:status.project.id,page:page.id,device,motion:'play'});
  const response=await fetch(bridge.url+'/__space/render?'+query);
  if(!response.ok)throw new Error('Render HTTP '+response.status);
  const file=path.resolve('.space/cv-check-'+variant+'-'+device+'.html');writeFileSync(file,await response.text());
  await withBrowser(async tab=>{
   await tab.send('Page.enable');
   await tab.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:device==='mobile'});
   await tab.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
   await tab.send('Page.navigate',{url:'file://'+file});
   const evaluate=async expression=>{const r=await tab.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value};
   for(let i=0;i<80;i++){if(await evaluate(`!!document.querySelector('${selectors.at(-1)}')`))break;await new Promise(r=>setTimeout(r,200))}
   await evaluate('(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(async i=>{i.loading="eager";try{await i.decode()}catch{}}));return true})()');
   const info=await evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,text:document.body.innerText,images:[...document.images].map(i=>({url:new URL(i.src).pathname,loaded:i.complete&&i.naturalWidth>0})),title:document.title})`);
   if(info.scrollWidth>width+1)throw new Error(variant+' '+device+' overflow '+info.scrollWidth);
   if(info.images.some(i=>!i.loaded||!i.url.startsWith('/brands/claudia-vialle/')))throw new Error(variant+' missing or unrelated image '+JSON.stringify(info.images));
   if(/Horizonte|CASA AREIA|PÁTIO OLIVA|CASA BRISA|horizonte\.exemplo/.test(info.text))throw new Error(variant+' placeholder brand remains');
   const photos=info.images.filter(i=>i.url.includes('/photos/'));
   if(new Set(photos.map(i=>i.url)).size!==photos.length)throw new Error(variant+' repeated photo');
   if(photos.length!==(variant==='editorial'?7:9))throw new Error(variant+' unexpected photo count '+photos.length);
   if(variant==='case2'){
    await evaluate("document.querySelector('[data-step=\"3\"]').click();true");await new Promise(r=>setTimeout(r,180));
    const counter=await evaluate("document.querySelector('[data-counter]').textContent");
    if(counter!=='04 / 04')throw new Error('Last process stage inaccessible');
    await evaluate("document.querySelector('[data-step=\"0\"]').click();true");
   }
   delete info.text;
   for(let i=0;i<selectors.length;i++){
    const rect=await evaluate(`(()=>{const r=document.querySelector('${selectors[i]}').getBoundingClientRect();return{x:0,y:Math.max(0,r.y+scrollY),width:innerWidth,height:r.height}})()`);
    await evaluate(`scrollTo(0,${rect.y});true`);await new Promise(r=>setTimeout(r,100));
    const shot=await tab.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{...rect,scale:1}});
    writeFileSync(path.join(directory,variant+'-'+device+'-'+String(i+1).padStart(2,'0')+'.png'),Buffer.from(shot.data,'base64'));
   }
   reports.push({variant,device,...info});
   console.log(variant+' '+device+': '+photos.length+' real photos loaded, official mark loaded, no overflow or placeholder brands'+(variant==='case2'?', lateral process verified.':'.'));
  });
 }
}
const a=new Set(reports.find(r=>r.variant==='editorial').images.filter(i=>i.url.includes('/photos/')).map(i=>i.url));
for(const i of reports.find(r=>r.variant==='case2').images)if(a.has(i.url))throw new Error('Photo repeated between proposals');
writeFileSync(path.join(directory,'verification.json'),JSON.stringify(reports,null,2));

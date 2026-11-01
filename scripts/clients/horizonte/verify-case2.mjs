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


const directory = path.resolve(process.argv[2] || 'artifacts/horizonte-case2');
mkdirSync(directory,{recursive:true});
const bridge=JSON.parse(readFileSync('.space/bridge.json','utf8'));
const status=JSON.parse(readFileSync('.space/avence-case-arquitetura-exemplo/status.json','utf8'));
const page=status.pages.find(p=>p.name==='Case 2');
if(!page)throw new Error('Case 2 not found');
const reports=[];
for(const [device,width,height] of [['desktop',1440,900],['mobile',390,844]]){
 const query=new URLSearchParams({token:bridge.token,project:status.project.id,page:page.id,device,motion:'play'});
 const response=await fetch(bridge.url+'/__space/render?'+query);
 if(!response.ok)throw new Error('Local render not ready: '+response.status);
 const localHtml=path.resolve('.space/case2-check-'+device+'.html');
 writeFileSync(localHtml,await response.text());
 await withBrowser(async tab=>{
  await tab.send('Page.enable');
  await tab.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:device==='mobile'});
  await tab.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await tab.send('Page.navigate',{url:'file://'+localHtml});
  const evaluate=async expression=>{const r=await tab.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value};
  for(let i=0;i<80;i++){if(await evaluate('!!document.querySelector(".tq-footer")'))break;await new Promise(r=>setTimeout(r,200))}
  await evaluate('(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(async i=>{i.loading="eager";try{await i.decode()}catch{}}));return true})()');
  const info=await evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,title:document.title,body:document.body.innerText.slice(0,240),images:[...document.images].map(i=>({src:new URL(i.src).pathname,loaded:i.complete&&i.naturalWidth>0}))})');
  if(info.scrollWidth>width+1)throw new Error(device+' overflow '+info.scrollWidth);
  if(info.images.length!==13||new Set(info.images.map(i=>i.src)).size!==13)throw new Error(device+' duplicate or missing image slots: '+JSON.stringify(info));
  if(info.images.some(i=>!i.loaded||!i.src.includes("/arquitetura/case-2/")))throw new Error(device+' image missing or shared');

  const processInfo=await evaluate(`(()=>{const t=document.querySelector('.tq-steps');return{cards:t.querySelectorAll('.tq-step').length,buttons:document.querySelectorAll('[data-step]').length,width:t.clientWidth,scrollWidth:t.scrollWidth,direction:getComputedStyle(t).flexDirection,ready:document.querySelector('.tq-process-controls').dataset.ready,pin:document.documentElement.classList.contains('tq-pin')}})()`);
  if(processInfo.cards!==4||processInfo.buttons!==4||processInfo.direction!=='row'||processInfo.scrollWidth<=processInfo.width||processInfo.ready!=='true'||processInfo.pin)throw new Error(device+' process region: '+JSON.stringify(processInfo));
  await evaluate("document.querySelector('[data-step=\"3\"]').click();true");
  await new Promise(r=>setTimeout(r,200));
  const lastStep=await evaluate(`(()=>{const t=document.querySelector('.tq-steps'),s=t.querySelectorAll('.tq-step')[3],a=t.getBoundingClientRect(),b=s.getBoundingClientRect();return{counter:document.querySelector('[data-counter]').textContent,left:t.scrollLeft,visible:b.left>=a.left-2&&b.right<=a.right+2,nextDisabled:document.querySelector('[data-next]').disabled}})()`);
  if(lastStep.counter!=='04 / 04'||!lastStep.visible||!lastStep.nextDisabled)throw new Error(device+' last stage inaccessible: '+JSON.stringify(lastStep));
  await evaluate("document.querySelector('[data-prev]').click();true");await new Promise(r=>setTimeout(r,160));
  const previousCounter=await evaluate("document.querySelector('[data-counter]').textContent");
  if(previousCounter!=='03 / 04')throw new Error(device+' previous control did not reach step 03: '+previousCounter+' '+await evaluate("JSON.stringify({left:document.querySelector('.tq-steps').scrollLeft, positions:[...document.querySelectorAll('.tq-step')].map(s=>s.getBoundingClientRect().left)})"));
  await evaluate("document.querySelector('.tq-steps').dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));true");await new Promise(r=>setTimeout(r,160));
  const firstStep=await evaluate("({counter:document.querySelector('[data-counter]').textContent,disabled:document.querySelector('[data-prev]').disabled,left:document.querySelector('.tq-steps').scrollLeft})");
  if(firstStep.counter!=='01 / 04'||!firstStep.disabled||firstStep.left>2)throw new Error(device+' keyboard home failed');
  info.process={...processInfo,lastStep,firstStep,previousCounter};
  await evaluate("document.querySelector('[data-step=\"3\"]').click();true");await new Promise(r=>setTimeout(r,160));
  const procBox=await evaluate("(()=>{const b=document.querySelector('.tq-proc').getBoundingClientRect();return{x:0,y:b.y+scrollY,width:innerWidth,height:b.height}})()");
  await evaluate(`scrollTo(0,${procBox.y});true`);await new Promise(r=>setTimeout(r,100));
  const lastShot=await tab.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{...procBox,scale:1}});
  writeFileSync(path.join(directory,device+'-processo-etapa-04.png'),Buffer.from(lastShot.data,'base64'));

  await evaluate("document.querySelector('[data-step=\"0\"]').click();true");await new Promise(r=>setTimeout(r,160));

  const sections=['.tq-hero','.tq-studio','.tq-projects','.tq-proc','.tq-press','.tq-footer'];
  for(let i=0;i<sections.length;i++){
   const box=await evaluate(`(()=>{const r=document.querySelector('${sections[i]}').getBoundingClientRect();return{x:Math.max(0,r.x),y:Math.max(0,r.y+scrollY),width:Math.min(innerWidth,r.width),height:r.height}})()`);
   await evaluate(`scrollTo(0,${box.y});true`);await new Promise(r=>setTimeout(r,100));
   const shot=await tab.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{...box,scale:1}});
   writeFileSync(path.join(directory,device+'-'+String(i+1).padStart(2,'0')+'.png'),Buffer.from(shot.data,'base64'));
  }
  reports.push({device,...info});console.log(device+': 13 images loaded, 13 distinct image URLs, no horizontal overflow; lateral scroll, all four stages, arrows and keyboard verified.');
 });
}
writeFileSync(path.join(directory,'verification.json'),JSON.stringify(reports,null,2));

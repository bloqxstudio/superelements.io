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

const directory = path.resolve(process.argv[2] || 'artifacts/horizonte-refinamento');
mkdirSync(directory, { recursive: true });
const bridge = JSON.parse(readFileSync('.space/bridge.json', 'utf8'));
const query = new URLSearchParams({ token: bridge.token, project: '817e7afc-f37b-46b0-95da-860469e8e8aa', motion: 'play' });
// Resolve the full page id from the latest pull rather than guessing a suffix.
const status = JSON.parse(readFileSync('.space/avence-case-arquitetura-exemplo/status.json', 'utf8'));
const page = status.pages.find(item => item.name === 'teste');
if (!page) throw new Error('Página teste não encontrada');
query.set('page', page.id);
const report = [];
for (const [device, width, height] of [['desktop',1440,900],['mobile',390,844]]) {
  query.set('device', device);
  await withBrowser(async tab => {
    await tab.send('Page.enable');
    await tab.send('Runtime.enable');
    await tab.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor:1, mobile:device==='mobile' });
    await tab.send('Page.navigate', { url:`${bridge.url}/__space/render?${query}` });
    const evaluate = async expression => {
      const result=await tab.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
      if(result.exceptionDetails)throw new Error(result.exceptionDetails.text);
      return result.result.value;
    };
    // Wait for the local document, then fonts and image decoding, not a fixed network-idle timer.
    for(let i=0;i<80;i++) {
      if(await evaluate('document.querySelectorAll(".kn-footer").length'))break;
      await new Promise(resolve=>setTimeout(resolve,200));
    }
    await evaluate(`(async()=>{
      await document.fonts.ready;
      await Promise.all([...document.images].map(async image=>{
        image.loading='eager';
        try{await image.decode()}catch{}
      }));
      return true;
    })()`);
    const info=await evaluate(`({
      width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
      images:[...document.images].map(i=>({src:new URL(i.src).pathname,loaded:i.complete&&i.naturalWidth>0})),
      sections:[...document.querySelectorAll('body > .elementor > .e-con,body > .e-con')].length,
      initialized:!!window.__horizonteRefined,
      header:[...document.querySelectorAll('.kn-logo,.kn-nav')].map(e=>({x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right})),
      height:document.documentElement.scrollHeight
    })`);
    if(info.scrollWidth>width+1)throw new Error(`${device}: horizontal overflow ${info.scrollWidth}`);
    if(info.images.some(image=>!image.loaded))throw new Error(`${device}: missing images ${JSON.stringify(info.images.filter(image=>!image.loaded))}`);
    if(!info.initialized)throw new Error(`${device}: motion script did not initialize`);
    if(info.header[0].right>info.header[1].x+1)throw new Error(`${device}: overlapping header`);
    // Exercise every part of the page in normal-motion mode.
    for(let y=0;y<info.height;y+=height*.8){
      await evaluate(`scrollTo(0,${y});true`);
      await new Promise(resolve=>setTimeout(resolve,85));
    }
    // Changing the accessibility preference mid-session must cancel running animations.
    await tab.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await new Promise(resolve=>setTimeout(resolve,120));
    const active=await evaluate('document.getAnimations().filter(a=>a.playState==="running").length');
    if(active)throw new Error(`${device}: animations continue with reduced motion`);
    const selectors=['.kn-hero','.kn-sis','.kn-about','.kn-scope','.kn-sketches','.kn-projects','.kn-radial','.kn-people','.kn-brands','.kn-footer'];
    for(let index=0;index<selectors.length;index++){
      const rect=await evaluate(`(()=>{const b=document.querySelector('${selectors[index]}').getBoundingClientRect();return{x:Math.max(0,b.x),y:Math.max(0,b.y+scrollY),width:Math.min(innerWidth,b.width),height:b.height}})()`);
      await evaluate(`scrollTo(0,${rect.y});true`);
      await new Promise(resolve=>setTimeout(resolve,60));
      const result=await tab.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{...rect,scale:1}});
      writeFileSync(path.join(directory,`${device}-${String(index+1).padStart(2,'0')}.png`),Buffer.from(result.data,'base64'));
    }
    report.push({device,...info,reducedMotionRunningAnimations:active});
  });
  console.log(`Verified ${device}: images loaded, no horizontal overflow, header separated, motion initialized and reduced-motion cleanup passed.`);
}
writeFileSync(path.join(directory,'verification.json'),JSON.stringify(report,null,2));

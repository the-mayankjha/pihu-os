import { chromium } from 'playwright';
import { createConnection } from '@playwright/mcp';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Cargo/Tauri's loader overrides must not leak into the independent Chrome process.
export function browserEnvironment(source = process.env) {
  return Object.fromEntries(Object.entries(source).filter(([key,value]) =>
    value !== undefined && !key.startsWith('DYLD_') && !['LD_PRELOAD','LD_LIBRARY_PATH'].includes(key)));
}
export function friendlyBrowserError(error) {
  const raw = String(error.message || error).replace(/\x1b\[[0-9;]*m/g, '');
  if (/ProcessSingleton|SingletonLock|profile.*(?:in use|already)|user data directory.*in use/i.test(raw))
    return 'Pihu’s browser profile is already in use. Close the other Pihu automation session and retry.';
  if (/launchPersistentContext|Chrome startup/i.test(raw) && /Timeout|timed out/i.test(raw))
    return 'Chrome did not finish starting. Restart Pihu and retry; if its automation Chrome window is stuck, close that window first.';
  if (/Executable doesn.t exist|chrome.*not found|distribution.*not found/i.test(raw))
    return 'Google Chrome could not be found. Install Chrome, then restart Pihu.';
  return raw.split(/Call log:|\n### |\n\s*at |\s+at eval \(|\n\s*- <launching>/)[0].replace(/^### Error\s*/, '').trim().slice(0, 500);
}

export async function connectBrowser(options = {}) {
  let context;
  const profile = options.profile || path.join(homedir(), '.pihu-os', 'browser-profile');
  const getContext = async () => {
    if (!context) context = await chromium.launchPersistentContext(profile, {channel:'chrome',headless:!!options.headless,timeout:30000,env:browserEnvironment()});
    return context;
  };
  const server = await createConnection({ timeouts:{action:5000,navigation:20000},webmcp:false }, getContext);
  const client = new Client({ name: 'pihu-browser-client', version: '1.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  await client.connect(a);
  return { client, close: async () => { await client.close(); await server.close(); if(context)await context.close(); } };
}
export async function call(client, name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
  if (result.isError) throw Error(text || `${name} failed`);
  return text;
}
export async function evaluate(client, fn, args = {}) {
  const text = await call(client, 'browser_evaluate', { function: `() => (${fn.toString()})(${JSON.stringify(args)})` });
  const match = text.match(/### Result\s*\n([\s\S]*?)(?:\n### |$)/);
  if (!match) throw Error('Playwright returned no structured evaluation result');
  return JSON.parse(match[1].trim());
}
const visibleVideos = () => {
  const unique = new Map();
  for (const a of document.querySelectorAll('a[href*="/watch?"]')) {
    const u = new URL(a.href), rect = a.getBoundingClientRect();
    const overlap = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
    if (!u.searchParams.get('v') || rect.width < 30 || rect.height < 15 || overlap < rect.height * .5 || rect.left >= innerWidth || rect.right <= 0) continue;
    const title = a.getAttribute('title') || a.getAttribute('aria-label') || a.textContent.trim();
    const key = u.searchParams.get('v');
    const previous = unique.get(key);
    if (!previous) unique.set(key, { title, url: a.href, x: rect.x, y: rect.y });
    else if (!previous.title && title) previous.title = title;
  }
  return [...unique.values()].sort((a,b) => Math.abs(a.y-b.y) < 12 ? a.x-b.x : a.y-b.y).map((v,index) => ({ ...v,index:index+1 }));
};
const media = p => {
  const v = document.querySelector('video');
  if (!v) throw Error('No video player on this page');
  if (p.action === 'play') return v.play().then(() => ({ message: 'Video playback started.', paused: v.paused }));
  if (p.action === 'pause') v.pause();
  if (p.action === 'mute') v.muted = true;
  if (p.action === 'unmute') v.muted = false;
  if (p.action === 'volume') v.volume = p.value / 100;
  if (p.action === 'seek') v.currentTime = Math.max(0, Math.min(Number.isFinite(v.duration) ? v.duration : Infinity, v.currentTime + p.value));
  if (p.action === 'fullscreen') return v.requestFullscreen().then(() => ({ message:'Video fullscreen enabled.' }));
  if (p.action === 'exit_fullscreen' && document.fullscreenElement) return document.exitFullscreen().then(() => ({ message:'Video fullscreen exited.' }));
  return { message:`Video ${p.action} applied.`, paused:v.paused, muted:v.muted, volume:Math.round(v.volume*100), time:v.currentTime };
};
export async function perform(client, p) {
  if (!p || typeof p !== 'object') throw Error('Invalid browser request');
  const action = p.action;
  if (action === 'tools') return { tools: (await client.listTools()).tools, message:'Playwright MCP connected.' };
  if (action === 'snapshot') return { snapshot: await call(client,'browser_snapshot'), message:'Read browser snapshot.' };
  if (action === 'navigate' || action === 'search') {
    let url = p.url;
    if (action === 'search') {
      if (typeof p.query !== 'string' || !p.query.trim() || p.query.length > 1500) throw Error('Invalid search query');
      const state = p.site === 'current' ? await evaluate(client, () => location.href) : '';
      const youtube = p.site === 'youtube' || (p.site === 'current' && /(^|\.)youtube\.com$/.test(new URL(state).hostname));
      url = (youtube ? 'https://www.youtube.com/results?search_query=' : 'https://www.google.com/search?q=') + encodeURIComponent(p.query);
    }
    if (typeof url !== 'string' || !/^https?:$/.test(new URL(url).protocol)) throw Error('Use an HTTP or HTTPS URL');
    await call(client,'browser_navigate',{url});
    return { message:action==='search'?`Searched for ${p.query}.`:'Opened page.', url };
  }
  if (action === 'state') return { ...(await evaluate(client,() => ({url:location.href,title:document.title}))), message:'Read current tab.' };
  if (action === 'videos') return { items:await evaluate(client, visibleVideos), message:'Read visible videos.' };
  if (action === 'search_play') {
    await perform(client,{action:'search',query:p.query,site:'youtube'});
    return perform(client,{action:'open_video',index:1});
  }
  if (action === 'open_video') {
    if (!Number.isInteger(p.index ?? 1) || (p.index ?? 1)<1 || (p.index ?? 1)>40) throw Error('Video index must be 1 to 40');
    let items=[];
    for (let i=0;i<5;i++) { items=await evaluate(client,visibleVideos); if(items.length >= (p.index ?? 1)) break; await new Promise(r=>setTimeout(r,500)); }
    const video=items[(p.index ?? 1)-1];
    if (!video) throw Error('Requested visible video is unavailable; scroll or inspect videos first');
    await call(client,'browser_navigate',{url:video.url});
    for(let i=0;i<10;i++){if(await evaluate(client,()=>!!document.querySelector('video')))break;await new Promise(r=>setTimeout(r,500));}
    const result=await evaluate(client,media,{action:'play'});
    if(result.paused) throw Error('The video opened but playback was not confirmed');
    return {...result,title:video.title,url:video.url};
  }
  if(action==='play'){const url=await evaluate(client,()=>location.href);if(new URL(url).hostname==='www.youtube.com' && new URL(url).pathname==='/results')return perform(client,{action:'open_video',index:1});}
  if (['play','pause','mute','unmute','volume','seek','fullscreen','exit_fullscreen'].includes(action)) {
    if(action==='volume' && (!Number.isFinite(p.value)||p.value<0||p.value>100))throw Error('Volume must be 0 to 100');
    if(action==='seek' && (!Number.isFinite(p.value)||Math.abs(p.value)>3600))throw Error('Seek offset must be within 3600 seconds');
    return evaluate(client,media,p);
  }
  if(action==='focus_search')return evaluate(client,()=>{const f=document.querySelector('input[name="search_query"],input[name="q"]');if(!f)throw Error('No search field');f.focus();return {message:'Focused search field.'};});
  if(action==='reload'){await evaluate(client,()=>location.reload());return {message:'Reload requested.'};}
  if(action==='back'){await call(client,'browser_navigate_back');return {message:'Went back.'};}
  if(action==='forward'){await evaluate(client,()=>history.forward());return {message:'Forward navigation requested.'};}
  if(action==='scroll'){if(!['up','down','left','right'].includes(p.direction))throw Error('Invalid scroll direction');await evaluate(client,p=>window.scrollBy({left:p.direction==='left'?-500:p.direction==='right'?500:0,top:p.direction==='up'?-500:p.direction==='down'?500:0}),p);return {message:`Scrolled ${p.direction}.`};}
  if(action==='click'){
    if(!p.ref && (typeof p.label!=='string'||!p.label.trim()))throw Error('Use a fresh snapshot ref or exact label');
    if(p.ref && (typeof p.ref!=='string'||!/^e\d+$/.test(p.ref)))throw Error('Invalid snapshot ref');
    let target=p.ref;
    let resolved=p.label;
    if(!target){
      const match=await evaluate(client,({label})=>{
        const normalize=s=>s.toLowerCase().replace(/\s+/g,' ').trim();
        const wanted=normalize(label).replace(/^(?:the )/,'').replace(/ button$/,'');
        const controls=[...document.querySelectorAll('button,a[href],input[type="button"],input[type="submit"],[role="button"]')]
          .filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth&&getComputedStyle(e).visibility!=='hidden';})
          .map(e=>({name:e.getAttribute('aria-label')||e.innerText||e.value||'',button:e.matches('button,input,[role="button"]')}));
        const exact=controls.filter(e=>normalize(e.name)===wanted);
        const canonical=s=>normalize(s).replace(/\bcounter\b/g,'count').replace(/\s*:\s*\d+$/,'');
        const stem=canonical(wanted).replace(/\s+by doing$/,'');
        const matches=exact.length?exact:controls.filter(e=>canonical(e.name)===stem);
        if(matches.length!==1)throw Error(matches.length?'More than one control matches. Specify its full label.':'No visible interactive control matches "'+label+'" in the controlled tab.');
        return matches[0];
      },{label:p.label});
      resolved=match.name;
      target=match.button?`role=button[name=${JSON.stringify(match.name)}s]`:`text=${JSON.stringify(match.name)}`;
    }
    await call(client,'browser_click',{target,element:resolved||'Selected element'});return {message:`Clicked ${resolved||'selected element'}.`};
  }
  if(action==='type'){if(typeof p.ref!=='string'||!/^e\d+$/.test(p.ref)||typeof p.text!=='string'||p.text.length>5000)throw Error('Invalid typing request');await call(client,'browser_type',{target:p.ref,text:p.text,submit:!!p.submit});return {message:'Entered text.'};}
  if(action==='tabs'){return {tabs:await call(client,'browser_tabs',{action:p.tab_action||'list',index:p.index}),message:'Updated browser tabs.'};}
  throw Error('Unsupported browser MCP action');
}
async function main() {
  console.log = (...args) => console.error(...args);
  const connection = await connectBrowser();
  const input = createInterface({input:process.stdin,crlfDelay:Infinity});
  for await (const line of input) {
    let response;
    try { if(line.length>32768)throw Error('Request too large');const payload=JSON.parse(line);if(payload.action==='shutdown')break;response={success:true,data:await perform(connection.client,payload)}; }
    catch(error){console.error('[Browser MCP]',String(error.stack||error).slice(0,10000));response={success:false,error:friendlyBrowserError(error)};}
    process.stdout.write(JSON.stringify(response)+'\n');
  }
  await connection.close();
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e);process.exitCode=1;});

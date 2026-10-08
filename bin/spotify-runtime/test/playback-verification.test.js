import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
test('playback success requires playing state on requested device and track', async () => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pihu-playback-'));
 process.env.SPOTIFY_CONFIG_PATH=path.join(dir,'config.json');
 fs.writeFileSync(process.env.SPOTIFY_CONFIG_PATH,JSON.stringify({clientId:'test',clientSecret:'test',redirectUri:'http://127.0.0.1:8888/callback',accessToken:'test',expiresAt:Date.now()+3600000}));
 const { playTools } = await import('../build/play.js');
 const original=globalThis.fetch; let mode='paused'; let sent;
 globalThis.fetch=async(url,options)=>{
  if(String(url).endsWith('/devices')) return new Response(JSON.stringify({devices:[{id:'device',is_active:true,name:'Desktop'}]}));
  if(options?.method==='PUT') {sent=JSON.parse(options.body);return new Response(null,{status:204});}
  return new Response(JSON.stringify({is_playing:mode==='playing',device:{id:'device',name:'Desktop'},item:{uri:'spotify:track:test',name:'Perfect'}}));
 };
 try {
  const tool=playTools.find(t=>t.name==='playMusic');
  const failure=await tool.handler({type:'track',id:'test'},{});
  assert.match(failure.content[0].text,/could not be confirmed/);
  assert.equal(failure.content[0].isError,true);
  mode='playing';
  const success=await tool.handler({type:'track',id:'test'},{});
  assert.match(success.content[0].text,/Now playing: Perfect on Desktop/);
  assert.deepEqual(sent,{uris:['spotify:track:test']});
 } finally {globalThis.fetch=original;delete process.env.SPOTIFY_CONFIG_PATH;fs.rmSync(dir,{recursive:true,force:true});}
});

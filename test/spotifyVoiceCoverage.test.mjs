import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const catalog=JSON.parse(fs.readFileSync('src/core/services/spotifyToolCatalog.json'));
let called;
let source=fs.readFileSync('src/core/voice/intent/tools/spotifyTools.ts','utf8')
 .replace(/import catalog[^;]+;/,`const catalog=${JSON.stringify(catalog)};`)
 .replace(/import \{ callSpotifyTool \}[^;]+;/,'const callSpotifyTool = async (name,args) => globalThis.__spotifyCall(name,args);');
globalThis.__spotifyCall=async(name,args)=>{called={name,args};return {message:'ok'}};
const load=async source=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
try {
 const {spotifyTools}=await load(source);
 assert.equal(spotifyTools.length,30);
 for(const entry of catalog){
  const tool=spotifyTools.find(t=>t.declaration.name===`spotify_${entry.name}`);
  assert.ok(tool,entry.name);
  assert.deepEqual(Object.keys(tool.declaration.parameters.properties),Object.keys(entry.inputSchema.properties||{}));
  assert.deepEqual(tool.declaration.parameters.required,entry.inputSchema.required||[]);
  const args={test:'forward unchanged'};
  assert.equal((await tool.execute(args)).success,true);
  assert.deepEqual(called,{name:entry.name,args});
 }
 const {parseSpotifyIntent}=await load(fs.readFileSync('src/core/services/spotifyIntent.ts','utf8'));
 for(const text of ['play my workout playlist on Spotify','search for podcasts on Spotify','play Perfect on my speaker on Spotify','play Perfect and add it to my playlist on Spotify']) assert.equal(parseSpotifyIntent(text),null,text);
 assert.equal(parseSpotifyIntent('show my queue on Spotify').name,'getQueue');
 assert.equal(parseSpotifyIntent('play Perfect on Spotify').query,'Perfect');
 console.log('All 30 Spotify voice tools, schemas, dispatch, and complex routing checks passed.');
} finally {delete globalThis.__spotifyCall;}

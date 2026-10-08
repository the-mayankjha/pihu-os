import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync('src/core/services/whatsappBridge.ts','utf8').replace("import { invoke } from '@tauri-apps/api/core';",'const invoke = async () => {};');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {waitForWhatsAppConnection,hasWhatsAppSession}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const old=globalThis.fetch;
try {
 let polls=0;
 globalThis.fetch=async()=>new Response(JSON.stringify(++polls===1 ? {connected:false,logged_in:false,has_session:true} : {connected:true,logged_in:true,has_session:true}));
 assert.equal((await waitForWhatsAppConnection()).logged_in,true);
 assert.equal(polls,2);
 globalThis.fetch=async()=>new Response(JSON.stringify({connected:false,logged_in:false,has_session:true}));
 await assert.rejects(waitForWhatsAppConnection(0),/linked; no QR scan/);
 globalThis.fetch=async()=>new Response(JSON.stringify({connected:false,logged_in:false,has_session:false}));
 assert.equal(hasWhatsAppSession(await waitForWhatsAppConnection()),false);
 globalThis.fetch=async()=>{throw new Error('network unavailable')};
 await assert.rejects(waitForWhatsAppConnection(),/network unavailable/);
 console.log('WhatsApp reconnect, genuine unpaired, and network failure checks passed. No messages sent.');
} finally {globalThis.fetch=old;}

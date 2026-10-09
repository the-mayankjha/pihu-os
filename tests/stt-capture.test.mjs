import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const src=fs.readFileSync(new URL('../src/core/voice/stt/STTManager.ts', import.meta.url),'utf8');
const code=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
let now=1000, intervals=new Map(), counter=0;
Date.now=()=>now;
globalThis.setInterval=fn=>{let id=++counter;intervals.set(id,fn);return id};globalThis.clearInterval=id=>intervals.delete(id);
globalThis.setTimeout=()=>++counter;globalThis.clearTimeout=()=>{};
class WS {static OPEN=1;readyState=0;sent=[];constructor(){queueMicrotask(()=>{this.readyState=1;this.onopen?.()})}send(x){this.sent.push(x)}close(){this.readyState=3;this.onclose?.()}}
globalThis.WebSocket=WS;
let contexts=[], tracks=[];
class Context {sampleRate=48000;state='suspended';resumed=false;constructor(){contexts.push(this)}resume(){this.resumed=true;this.state='running';return Promise.resolve()}close(){this.state='closed';return Promise.resolve()}createMediaStreamSource(){return {connect(){}}}createScriptProcessor(){return this.processor={connect(){},disconnect(){}}}destination={}}
globalThis.window={AudioContext:Context};
Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{getUserMedia:async()=>{const track={stopped:false,stop(){this.stopped=true}};tracks.push(track);return {getTracks:()=>[track]}}}},configurable:true});
const {STTManager}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
async function setup(){const manager=new STTManager();await Promise.resolve();await manager.startListening();return manager}
const m=await setup();assert(contexts.at(-1).resumed,'suspended context must resume');
let ended=0;m.onSpeechEnded=()=>ended++;
const processor=contexts.at(-1).processor;
const frame=value=>({inputBuffer:{getChannelData:()=>new Float32Array(4096).fill(value)}});
processor.onaudioprocess(frame(.1));now+=200;processor.onaudioprocess(frame(0));now+=1600;for(const fn of [...intervals.values()])fn();
assert.equal(ended,1);assert(m.ws.sent.some(v=>typeof v==='string' && JSON.parse(v).type==='process'));assert(tracks.at(-1).stopped);
const stalled=await setup();let error='';stalled.onError=e=>error=e;now+=5100;for(const fn of [...intervals.values()])fn();assert.match(error,/Microphone audio stopped/);assert(tracks.at(-1).stopped);
const idle=await setup();let timedOut=false;idle.onIdleTimeout=()=>timedOut=true;const idleProcessor=contexts.at(-1).processor;for(let i=0;i<7;i++){now+=1000;idleProcessor.onaudioprocess?.(frame(0));for(const fn of [...intervals.values()])fn()}assert(timedOut);
console.log('PASS: suspended-context resume, speech-end submission, stalled capture cleanup, silent idle timeout');

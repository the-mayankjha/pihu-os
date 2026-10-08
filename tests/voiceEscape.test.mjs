import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';

test('Escape stops speech, closes on repeat; follow-up listens for 15 seconds and expires to idle',async()=>{
  const voice={isActive:true,isListening:false,response:'Keep this response',reset(){this.isActive=false;this.response='';},setIsListening(v){this.isListening=v;},setIsActive(v){this.isActive=v;},setTranscription(v){this.transcription=v;},setProcessingStatus(v){this.processingStatus=v;}};
  const orb={currentState:'speaking',setState(v){this.currentState=v;}};
  let tts, stt;
  Object.defineProperty(globalThis, 'navigator', {value:{platform:'Linux'},configurable:true});
  class FakeTTS {constructor(){tts=this;this.isSpeaking=true;}stop(){this.isSpeaking=false;}}
  globalThis.__voiceEscapeMocks={
    invoke:async()=>{},listen:async()=>()=>{},
    STTManager:class {constructor(){stt=this;}stopListening(){}async startListening(){this.started=true;}},TTSManager:FakeTTS,ActionEngine:class {},
    useVoiceStore:{getState:()=>voice},useOrbStore:{getState:()=>orb},
    parseUIIntent:()=>null,parseBrowserIntent:()=>null,rememberTarget:()=>{},
    OrbState:{WAKE:'wake',LISTENING:'listening',IDLE:'idle',SPEAKING:'speaking',THINKING:'thinking',EXECUTING:'executing'},
  };
  let source=await readFile(new URL('../src/core/voice/VoiceManager.ts',import.meta.url),'utf8');
  source=source.replace(/^import .*;\n/gm,'');
  source='const messageNotifications={start(){},awaitingReply:false}; const WHATSAPP_API_URL="http://127.0.0.1:8080/api"; const {invoke,listen,STTManager,TTSManager,ActionEngine,useVoiceStore,useOrbStore,parseUIIntent,parseBrowserIntent,rememberTarget,OrbState}=globalThis.__voiceEscapeMocks;\n'+stripTypeScriptTypes(source);
  const {VoiceManager}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const manager=VoiceManager.getInstance();
  manager.handleEscape();
  assert.equal(tts.isSpeaking,false);
  assert.equal(voice.isActive,true);
  assert.equal(voice.response,'Keep this response');
  manager.handleEscape();
  assert.equal(voice.isActive,false);
  assert.equal(voice.response,'');
  voice.response='Completed answer';
  await manager.startListening(true);
  assert.equal(stt.idleTimeoutMs,15000);
  assert.equal(stt.started,true);
  assert.equal(voice.isListening,true);
  assert.equal(voice.response,'Completed answer');
  assert.equal(orb.currentState,'listening');
  stt.onIdleTimeout();
  assert.equal(voice.isActive,false);
  assert.equal(orb.currentState,'idle');
  delete globalThis.__voiceEscapeMocks;
});

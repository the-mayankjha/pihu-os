import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
async function load(path, bindings) {
  const source = fs.readFileSync(path, 'utf8').replace(/^import .*;\n/gm, '');
  const code = bindings + ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
}
const state = {setIsListening(){},setProcessingStatus(){}};
let decision = async () => 'CONTINUE';
globalThis.voiceTest = {state, llm:{getInstance:()=>({generatePrimaryTask:()=>decision()})}};
const {VoiceManager} = await load('src/core/voice/VoiceManager.ts', `const useVoiceStore={getState:()=>globalThis.voiceTest.state}; const LLMManager=globalThis.voiceTest.llm; const OrbState={SPEAKING:'speaking'};`);
function manager() {
  const m = Object.create(VoiceManager.prototype);
  Object.assign(m, {interruptionPending:true,interruptionGeneration:1,speechGeneration:1,speakingResponse:'Here is the original answer.',activeSpeech:Promise.resolve(),interruptionListener:{stopListening(){}},ttsManager:{isSpeaking:true,resume(){m.resumed=true},stop(){m.stopped=true}},sttManager:{onSpeechEnded(){},onTranscription(text){m.input=text}},actionEngine:{addSystemNote(text){m.note=text}},setOrbState(){},monitorInterruptions(){m.monitored=true}});
  return m;
}
let m=manager(); await m.considerInterruption('okay thanks'); assert(m.resumed); assert.equal(m.input,undefined);
m=manager(); await m.considerInterruption('Actually explain the second step'); assert(m.stopped); assert.equal(m.input,'Actually explain the second step'); assert.match(m.note,/original answer/);
let resolveDecision;decision=()=>new Promise(resolve=>resolveDecision=resolve);
m=manager();const pending=m.considerInterruption('Could you explain that differently?');m.handleEscape();resolveDecision('CHANGE');await pending;assert(m.resumed);assert.equal(m.input,undefined);assert.equal(m.monitored,undefined);assert(m.interruptionsSuppressedForSpeech);
const synth={getVoices:()=>[],pause(){this.paused=true},resume(){this.paused=false},cancel(){}};
globalThis.window={speechSynthesis:synth};
const {TTSManager}=await load('src/core/voice/tts/TTSManager.ts', 'const useTTSPlaybackStore={getState:()=>({started(){},ended(){}})};');
const tts=new TTSManager();let played=0;tts.currentAudio={currentTime:3.5,pause(){},play(){played++;return Promise.resolve()}};tts.pause();let released=false;const gate=tts.waitUntilResumed().then(()=>released=true);await Promise.resolve();assert(!released);assert.equal(tts.currentAudio.currentTime,3.5);tts.resume();await gate;assert(released);assert.equal(played,1);assert.equal(tts.currentAudio.currentTime,3.5);
console.log('PASS: acknowledgement resumes, correction replaces with context, Esc cancels pending decision, TTS resumes at retained playback position');

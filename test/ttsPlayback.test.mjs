import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { useTTSPlaybackStore } from '../src/core/voice/tts/playbackStore.ts';

// Load the real TTS controller with a harmless voice settings stub. Browser
// audio callbacks are driven manually so no microphone or service is needed.
const original = await readFile(new URL('../src/core/voice/tts/TTSManager.ts', import.meta.url), 'utf8');
const playbackUrl = new URL('../src/core/voice/tts/playbackStore.ts', import.meta.url).href;
const source = original.replace("'./playbackStore'", JSON.stringify(playbackUrl))
  .replace("import { useVoiceStore } from '../../../stores/voiceStore';", 'const useVoiceStore = { getState: () => ({ setActiveVoiceEngine() {}, setActiveVoiceName() {} }) };');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { TTSManager } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('native TTS tracks playback start, interruption, stale completion and natural end', async () => {
  const previousWindow = globalThis.window;
  const previousUtterance = globalThis.SpeechSynthesisUtterance;
  const utterances = [];
  globalThis.window = { speechSynthesis: { speaking: false, getVoices: () => [], speak: utterance => utterances.push(utterance), cancel() {} } };
  globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  const manager = new TTSManager();
  let ends = 0;
  manager.onSpeechEnded = () => ends++;
  try {
    const first = manager.localSpeak('First');
    assert.equal(useTTSPlaybackStore.getState().active.length, 0, 'queued speech is not playback');
    utterances[0].onstart();
    assert.equal(useTTSPlaybackStore.getState().active.length, 1);
    manager.stop(); await first;
    assert.equal(useTTSPlaybackStore.getState().active.length, 0);
    const second = manager.localSpeak('Second');
    utterances[1].onstart();
    utterances[0].onend();
    assert.equal(ends, 0, 'interrupted completion cannot reset the voice state');
    assert.equal(useTTSPlaybackStore.getState().active.length, 1);
    utterances[1].onend(); await second;
    assert.equal(ends, 1);
    assert.equal(useTTSPlaybackStore.getState().active.length, 0);
  } finally {
    manager.stop();
    globalThis.window = previousWindow;
    globalThis.SpeechSynthesisUtterance = previousUtterance;
  }
});

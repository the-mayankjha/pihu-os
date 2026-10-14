import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSheetDimensions, validateSheetPixels, safeSpiritSize } from '../src/features/spirits/model.ts';
import { ANIMATIONS, spiritActivity, dragAnimation, lookDirection, lookCell, normalizeShortcuts, nearestSpirit, pihuPose, poseConfig } from '../src/features/spirits/model.ts';
import { useAgentActivityStore } from '../src/core/agent/activityStore.ts';
import { useTTSPlaybackStore } from '../src/core/voice/tts/playbackStore.ts';

test('Pihu plays with the cat only after 20 seconds idle and occasionally flips her hair', () => {
  assert.equal(pihuPose('idle', false, 19999), 'idle');
  assert.equal(pihuPose('idle', false, 20000), 'cat-play');
  assert.equal(pihuPose('idle', false, 12000), 'hair-flip');
  assert.equal(pihuPose('idle', false, 13000), 'idle');
  assert.equal(pihuPose('idle', false, 27000), 'hair-flip');
  assert.equal(pihuPose('idle', false, 28000), 'cat-play');
  assert.equal(poseConfig('cat-play').row, 7);
  assert.equal(poseConfig('hair-flip').row, 8);
});

test('Pihu idle activities never replace speaking, failure, waiting or review', () => {
  assert.equal(pihuPose('idle', true, 40000), 'speaking');
  assert.equal(pihuPose('failed', true, 40000), 'failed');
  assert.equal(pihuPose('waiting', false, 40000), 'waiting');
  assert.equal(pihuPose('review', false, 40000), 'review');
  assert.equal(pihuPose('running', false, 40000), 'waiting', 'Pihu work must not use the cat-play row');
});

test('actual TTS playback wins over processing and completion', () => {
  assert.equal(spiritActivity('idle', 'success', false, false, true, true).animation, 'review');
  assert.equal(spiritActivity('thinking', 'executing', true, true, true, true).animation, 'review');
  assert.equal(spiritActivity('idle', 'error', false, false, true, true).animation, 'failed');
  assert.equal(spiritActivity('idle', 'executing', false, false, true, false).animation, 'running');
});

test('an older playback ending cannot silence a newer playback', () => {
  const store = useTTSPlaybackStore.getState();
  store.started('old'); store.started('new'); store.ended('old');
  assert.deepEqual(useTTSPlaybackStore.getState().active, ['new']);
  store.ended('new');
  assert.deepEqual(useTTSPlaybackStore.getState().active, []);
});

test('social proximity excludes self, busy, stale and distant Spirits', () => {
  const self = { id: 'a', x: 0, y: 0, size: 128, busy: false, at: 5000 };
  const peer = { ...self, id: 'b', x: 150 };
  assert.equal(nearestSpirit(self, [self, peer], 5000)?.id, 'b');
  assert.equal(nearestSpirit(self, [{ ...peer, busy: true }, { ...peer, id: 'stale', at: 2000 }, { ...peer, id: 'far', x: 900 }], 5000), undefined);
  assert.equal(nearestSpirit(self, [peer, { ...peer, id: 'c', x: 100 }], 5000)?.id, 'c');
});

function sheet(rows = 11) {
  const width = 1536, height = rows * 208;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const counts = [6, 8, 8, 4, 5, 8, 6, 6, 6, 8, 8];
  for (let row = 0; row < rows; row++) for (let col = 0; col < counts[row]; col++) {
    pixels[((row * 208 + 100) * width + col * 192 + 90) * 4 + 3] = 255;
  }
  return { width, height, pixels };
}

test('shortcut preferences always restore three supported actions', () => {
  assert.deepEqual(normalizeShortcuts(undefined), ['voice', 'settings', 'commands']);
  assert.deepEqual(normalizeShortcuts(['tasks', 'music', 'widgets', 'voice']), ['tasks', 'music', 'widgets']);
  assert.deepEqual(normalizeShortcuts(['bogus', 'toString', null]), ['voice', 'settings', 'commands']);
});

test('imports accept both supported layouts and reject unrelated images', () => {
  for (const rows of [9, 11]) {
    const { width, height, pixels } = sheet(rows);
    assert.doesNotThrow(() => validateSheetPixels(width, height, pixels));
  }
  assert.throws(() => validateSheetDimensions(1024, 1024), /sprite sheet/);
});
test('imports reject missing poses, occupied unused frames, and opaque cells', () => {
  const { width, height, pixels } = sheet();
  const offset = (100 * width + 90) * 4 + 3;
  pixels[offset] = 0;
  assert.throws(() => validateSheetPixels(width, height, pixels), /Missing artwork/);
  pixels[offset] = 255;
  pixels[(100 * width + 7 * 192 + 90) * 4 + 3] = 255;
  assert.throws(() => validateSheetPixels(width, height, pixels), /Unused frame/);
  pixels[(100 * width + 7 * 192 + 90) * 4 + 3] = 0;
  for (let y = 0; y < 208; y++) for (let x = 0; x < 192; x++) pixels[(y * width + x) * 4 + 3] = 255;
  assert.throws(() => validateSheetPixels(width, height, pixels), /transparent background/);
});
test('size stays usable even with invalid persisted preferences', () => {
  assert.equal(safeSpiritSize(1), 72);
  assert.equal(safeSpiritSize(500), 192);
  assert.equal(safeSpiritSize(NaN), 128);
});

test('every standard row has an agent or interaction state', () => {
  const expected = { idle: 'idle', sleeping: 'idle', wake: 'waving', listening: 'waiting', thinking: 'running', executing: 'running', speaking: 'review', success: 'jumping', error: 'failed' };
  const used = new Set(['running-left', 'running-right']);
  for (const [orb, animation] of Object.entries(expected)) {
    const result = spiritActivity(orb, 'idle', false, false, false);
    assert.equal(result.animation, animation);
    assert.equal(result.resting, orb === 'sleeping');
    used.add(animation);
  }
  assert.deepEqual([...used].sort(), Object.keys(ANIMATIONS).sort());
});
test('agent tasks drive Spirits even when the voice orb is idle', () => {
  assert.equal(spiritActivity('idle', 'thinking', false, false, false).animation, 'running');
  assert.equal(spiritActivity('idle', 'executing', true, true, false).animation, 'running');
  assert.equal(spiritActivity('idle', 'error', true, true, false).animation, 'failed');
  assert.equal(spiritActivity('idle', 'idle', true, false, false).animation, 'waiting');
  assert.equal(spiritActivity('idle', 'success', true, true, false).animation, 'review');
  assert.equal(spiritActivity('idle', 'success', false, false, false).animation, 'jumping');
  assert.equal(spiritActivity('idle', 'idle', false, false, true).animation, 'running');
});
test('drag gait reverses horizontally and keeps direction during vertical movement', () => {
  assert.equal(dragAnimation(15), 'running-right');
  assert.equal(dragAnimation(-15), 'running-left');
  assert.equal(dragAnimation(0, 'running-left'), 'running-left');
  assert.equal(dragAnimation(0.5, 'running-left'), 'running-left');
});
test('cursor directions cover the complete clockwise v2 sweep without extra cells', () => {
  assert.equal(lookDirection(0, 0), null);
  for (let i = 0; i < 16; i++) {
    const angle = i * Math.PI / 8;
    assert.equal(lookDirection(100 * Math.sin(angle), -100 * Math.cos(angle)), i);
    assert.deepEqual(lookCell(i), { row: i < 8 ? 9 : 10, column: i % 8 });
  }
});
test('concurrent agent runs and settling timers cannot overwrite a newer task', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  useAgentActivityStore.setState({ status: 'idle', runs: {} });
  const activity = useAgentActivityStore.getState();
  const first = activity.begin();
  activity.phase(first, 'thinking');
  const second = activity.begin();
  activity.finish(first, true);
  assert.equal(useAgentActivityStore.getState().status, 'executing');
  t.mock.timers.tick(2000);
  assert.equal(useAgentActivityStore.getState().status, 'executing');
  activity.finish(second, true);
  assert.equal(useAgentActivityStore.getState().status, 'error');
  const third = activity.begin();
  activity.phase(third, 'thinking');
  t.mock.timers.tick(2000);
  assert.equal(useAgentActivityStore.getState().status, 'thinking');
  activity.finish(third, false);
  assert.equal(useAgentActivityStore.getState().status, 'success');
  t.mock.timers.tick(1800);
  assert.equal(useAgentActivityStore.getState().status, 'idle');
});

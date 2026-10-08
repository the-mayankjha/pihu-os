import test from 'node:test';
import assert from 'node:assert/strict';
import { planSequence, runSequence } from '../src/core/automation/sequenceIntent.ts';
test('open, snap and search use the same browser', () => {
  const p = planSequence('open safari , move it to right and search youtube');
  assert.equal(p.steps.length, 3);
  assert.equal(p.steps[1].args.app, 'safari');
  assert.equal(p.steps[1].args.action, 'snap_right');
  assert.equal(p.steps[2].args.browser, 'safari');
  assert.equal(p.steps[2].args.site, 'google');
});
test('two app contexts preserve browser and YouTube video dependency', () => {
  const p = planSequence('open safari , move it to right and open vs code and move it to left and search learn python on youtube and play the video');
  assert.equal(p.steps.length, 6);
  assert.equal(p.steps[3].args.app, 'vs code');
  assert.equal(p.steps[4].args.browser, 'safari');
  assert.equal(p.steps[4].args.query, 'learn python');
  assert.equal(p.steps[5].args.app, 'safari');
});
test('search conjunctions are not split; whole plan validated before execution', () => {
  assert.equal(planSequence('open Safari and search cats and dogs').steps[1].args.query, 'cats and dogs');
  assert.ok(planSequence('move it to right and open safari').error);
  assert.equal(planSequence('open safari and play the video').steps[1].args.action, 'play');
  assert.equal(planSequence('click YouTube or click first option'), null);
});
test('execution is sequential and failure stops subsequent steps', async () => {
  const plan = planSequence('open safari and move it to right and search youtube');
  const calls = [];
  const result = await runSequence(plan, async (tool, args) => {
    calls.push(args.action || args.query);
    return calls.length === 2 ? { success: false, error: 'Permission denied' } : { success: true, data: { message: 'Opened Safari.' } };
  });
  assert.deepEqual(calls, ['open', 'snap_right']);
  assert.match(result, /Completed 1 of 3 steps.*Stopped at step 2/);
});

test('search bar followed by search uses current site directly', () => {
  const p = planSequence('Click on search bar and search Perfect by Ed Sheeran');
  assert.equal(p.steps.length, 1);
  assert.equal(p.steps[0].tool, 'macos_control_browser');
  assert.equal(p.steps[0].args.site, 'current');
  assert.equal(p.steps[0].args.query, 'Perfect by Ed Sheeran');
});
test('exact Whisper transcription normalizes polite prefix and comma', () => {
  const plan = planSequence('Can you search, learn Python on YouTube and play second video?');
  assert.ok(!plan.error);
  assert.equal(plan.steps.length, 2);
  assert.equal(plan.steps[0].args.query, 'learn Python');
  assert.equal(plan.steps[0].args.site, 'youtube');
  assert.equal(plan.steps[1].args.action, 'open_video');
  assert.equal(plan.steps[1].args.index, 2);
});
test('polite wrappers preserve query punctuation and order', () => {
  const plan = planSequence('Could you please search, cats, dogs and birds on YouTube and play the third video?');
  assert.equal(plan.steps[0].args.query, 'cats, dogs and birds');
  assert.equal(plan.steps[1].args.index, 3);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUIIntent } from '../src/core/automation/uiIntent.ts';
test('scroll direction and named app', () => assert.deepEqual(parseUIIntent('scroll down 8 lines in Safari'), { action: 'scroll', direction: 'down', amount: 8, app: 'Safari' }));
test('result selection and labels', () => {
  assert.deepEqual(parseUIIntent('open the second result'), { action: 'click', kind: 'result', index: 2 });
  assert.deepEqual(parseUIIntent('click on YouTube'), { action: 'click', label: 'YouTube' });
  assert.equal(parseUIIntent('open my project'), null);
});
test('spoken option and self-correction', () => {
  assert.deepEqual(parseUIIntent('Click YouTube or click first option.'), { action: 'click', kind: 'result', index: 1 });
  assert.deepEqual(parseUIIntent('click first option'), { action: 'click', kind: 'result', index: 1 });
  assert.deepEqual(parseUIIntent('Click YouTube.com'), { action: 'click', label: 'YouTube.com' });
});
test('on first link and inspect visible items', () => {
  assert.deepEqual(parseUIIntent('Click on first link.'), { action: 'click', kind: 'link', index: 1 });
  assert.deepEqual(parseUIIntent('Inspect the visible items'), { action: 'inspect', kind: 'item' });
});
test('on browser qualifier does not become part of label', () => {
  assert.deepEqual(parseUIIntent('Click YouTube on Safari.'), { action: 'click', label: 'YouTube', app: 'Safari' });
  assert.deepEqual(parseUIIntent('click on YouTube'), { action: 'click', label: 'YouTube' });
});

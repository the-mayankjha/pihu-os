import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAppIntent } from '../src/core/automation/appIntent.ts';

test('app actions and window indices', () => {
  assert.deepEqual(parseAppIntent('Open Chrome'), { action: 'open', app: 'Chrome', window: 1 });
  assert.deepEqual(parseAppIntent('minimize Safari window 2'), { action: 'minimize', app: 'Safari', window: 2 });
  assert.deepEqual(parseAppIntent('Chrome ko maximize karo'), { action: 'maximize', app: 'Chrome', window: 1 });
  assert.deepEqual(parseAppIntent('exit fullscreen Chrome'), { action: 'exit_fullscreen', app: 'Chrome', window: 1 });
  assert.deepEqual(parseAppIntent('snap left Safari'), { action: 'snap_left', app: 'Safari', window: 1 });
});
test('closing a window is distinct from quitting an application', () => {
  assert.equal(parseAppIntent('close this window').action, 'close_window');
  assert.equal(parseAppIntent('close Chrome window').action, 'close_window');
  assert.equal(parseAppIntent('close window of Chrome').action, 'close_window');
  assert.equal(parseAppIntent('close Chrome').action, 'quit');
});
test('frontmost targets and geometry', () => {
  assert.deepEqual(parseAppIntent('minimize current window'), { action: 'minimize', app: undefined, window: 1 });
  assert.deepEqual(parseAppIntent('move Safari to -100, 20'), { action: 'move', app: 'Safari', x: -100, y: 20 });
  assert.deepEqual(parseAppIntent('resize Safari to 800 by 600'), { action: 'resize', app: 'Safari', width: 800, height: 600 });
});
test('internal and compound commands retain their existing routes', () => {
  for (const command of ['open settings', 'close music', 'open project', 'open output window', 'close output window', 'open Chrome and then close Safari']) {
    assert.equal(parseAppIntent(command), null, command);
  }
});

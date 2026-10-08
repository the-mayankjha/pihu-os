import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBrowserIntent } from '../src/core/automation/browserIntent.ts';
test('browser and site searches', () => {
  assert.deepEqual(parseBrowserIntent('search Perfect by Ed Sheeran on YouTube in Safari'), { action:'search', query:'Perfect by Ed Sheeran', site:'youtube', app:'Safari' });
  assert.equal(parseBrowserIntent('search cats and dogs').query, 'cats and dogs');
});
test('media controls and video result index', () => {
  assert.equal(parseBrowserIntent('play the second video').index, 2);
  assert.equal(parseBrowserIntent('pause the video').action, 'pause');
  assert.equal(parseBrowserIntent('set video volume to 50 percent').value, 50);
  assert.equal(parseBrowserIntent('skip back 15 seconds').value, -15);
  assert.equal(parseBrowserIntent('mute the video').action, 'mute');
  assert.equal(parseBrowserIntent('go back').action, 'back');
  assert.equal(parseBrowserIntent('fullscreen video').action, 'fullscreen');
  assert.equal(parseBrowserIntent('open my project'), null);
});
test('named YouTube playback request retains query', () => {
  assert.deepEqual(parseBrowserIntent('Play Perfect by Ed Sheeran on YouTube in Safari'), { action:'search_play', query:'Perfect by Ed Sheeran', site:'youtube', app:'Safari' });
});
test('third video click and screenshot reference phrases', () => {
  assert.deepEqual(parseBrowserIntent('Click on the third video'), { action:'open_video', index:3 });
  assert.deepEqual(parseBrowserIntent('I want to play 3rd video from this'), { action:'open_video', index:3 });
  assert.deepEqual(parseBrowserIntent('play the third video in Safari'), { action:'open_video', index:3, app:'Safari' });
});
test('tab commands use MCP zero-based tab indices', () => {
  assert.deepEqual(parseBrowserIntent('open new tab'), {action:'tabs',tab_action:'new'});
  assert.deepEqual(parseBrowserIntent('switch to tab 3'), {action:'tabs',tab_action:'select',index:2});
  assert.equal(parseBrowserIntent('inspect the page').action,'snapshot');
});
test('polite standalone search and play accept STT comma', () => {
  assert.deepEqual(parseBrowserIntent('Can you search, learn Python on YouTube?'), {action:'search',query:'learn Python',site:'youtube'});
  assert.deepEqual(parseBrowserIntent('Could you please play, second video?'), {action:'open_video',index:2});
});

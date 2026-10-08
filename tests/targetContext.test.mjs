import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseTarget, rememberTarget, forgetTarget } from '../src/core/automation/targetContext.ts';
test('overlay focus preserves last app, explicit target and user focus override it', () => {
  rememberTarget('Safari');
  assert.equal(chooseTarget(undefined, 'Pihu OS'), 'Safari');
  assert.equal(chooseTarget('Google Chrome', 'Pihu OS'), 'Google Chrome');
  assert.equal(chooseTarget(undefined, 'Finder'), 'Finder');
  forgetTarget('Safari');
  assert.throws(() => chooseTarget(undefined, 'Pihu OS'), /Specify the target app/);
});
test('browser context survives switching to a code editor', async () => {
  const { chooseBrowserTarget } = await import('../src/core/automation/targetContext.ts');
  rememberTarget('Safari'); rememberTarget('Visual Studio Code');
  assert.equal(chooseBrowserTarget(undefined, 'Pihu OS'), 'Safari');
  assert.equal(chooseBrowserTarget(undefined, 'Google Chrome'), 'Google Chrome');
});

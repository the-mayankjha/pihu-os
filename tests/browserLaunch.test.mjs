import test from 'node:test';
import assert from 'node:assert/strict';
import { browserEnvironment, friendlyBrowserError } from '../bin/browser-runtime/bridge.mjs';
test('Chrome environment excludes Cargo loader paths without discarding normal variables', () => {
  const env={PATH:'/usr/bin',HOME:'/tmp',HTTPS_PROXY:'http://localhost:1',DYLD_LIBRARY_PATH:'/rust/target/debug',DYLD_INSERT_LIBRARIES:'/allocator.dylib',DYLD_FRAMEWORK_PATH:'/tmp',LD_PRELOAD:'bad.so'};
  assert.deepEqual(browserEnvironment(env),{PATH:env.PATH,HOME:env.HOME,HTTPS_PROXY:env.HTTPS_PROXY});
  assert.ok(env.DYLD_LIBRARY_PATH);
});
test('launch errors are concise and omit ANSI, arguments and allocator dumps', () => {
  const message=friendlyBrowserError(new Error('### Error TimeoutError: browserType.launchPersistentContext: Timeout 30000ms exceeded. Call log: \u001b[2m --user-data-dir=/secret Trying to load the allocator multiple times'));
  assert.match(message,/Chrome did not finish starting/);
  assert.ok(!message.includes('--user-data-dir'));
  assert.match(friendlyBrowserError('ProcessSingleton: profile is already in use'),/already in use/);
});

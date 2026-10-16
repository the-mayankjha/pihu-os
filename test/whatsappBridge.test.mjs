import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { spawnSync } from 'node:child_process';

async function loadBridge(invoke) {
  globalThis.__bridgeInvoke = invoke;
  let source = await readFile(new URL('../src/core/services/whatsappBridge.ts', import.meta.url), 'utf8');
  source = source.replace(/^import .*;\n/gm, '');
  return import('data:text/javascript;base64,' + Buffer.from('const invoke = globalThis.__bridgeInvoke;\n' + stripTypeScriptTypes(source) + `\n// ${Math.random()}`).toString('base64'));
}

test('bridge startup validates service identity, shares launches, and runs under sh', async () => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  let launches = 0;
  try {
    const bridge = await loadBridge(async () => { launches++; });
    const shell = spawnSync('/bin/sh', ['-n'], {input: bridge.WHATSAPP_START_COMMAND, encoding: 'utf8'});
    assert.equal(shell.status, 0, shell.stderr);
    globalThis.fetch = async () => new Response(JSON.stringify({connected: true, logged_in: true}));
    assert.equal(await bridge.ensureWhatsAppBridge(), true);
    assert.equal(launches, 0);
    globalThis.fetch = async () => new Response('Google callback page');
    await assert.rejects(bridge.ensureWhatsAppBridge(), /Port 8080 is occupied/);
    assert.equal(launches, 0);
    let calls = 0;
    globalThis.fetch = async () => {
      if (calls++ === 0) throw new TypeError('offline');
      return new Response(JSON.stringify({connected: false, logged_in: false}));
    };
    globalThis.setTimeout = (callback) => originalSetTimeout(callback, 0);
    const first = bridge.ensureWhatsAppBridge();
    const second = bridge.ensureWhatsAppBridge();
    assert.equal(first, second);
    assert.deepEqual(await Promise.all([first, second]), [true, true]);
    assert.equal(launches, 1);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
    delete globalThis.__bridgeInvoke;
  }
});

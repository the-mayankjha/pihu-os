import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { connectBrowser, perform, evaluate } from '../bin/browser-runtime/bridge.mjs';

test('real Playwright MCP: navigate, snapshot, click, type, tabs, video order and media', {timeout:60000}, async () => {
  const profile=await mkdtemp(path.join(tmpdir(),'pihu-mcp-'));
  const wave=Buffer.alloc(44+32000);
  wave.write('RIFF',0);wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(16000,24);wave.writeUInt32LE(32000,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(32000,40);
  const server=createServer((req,res)=>{if(req.url==='/tone.wav'){res.setHeader('content-type','audio/wav');res.end(wave);return;}res.setHeader('content-type','text/html');res.end(`<html><body><input aria-label="Search"><button onclick="this.textContent='Clicked'">Click me</button><button id="counter" onclick="this.textContent='Interactive Count: '+(++window.count)">Interactive Count: 0</button><script>window.count=0</script><video muted loop src="/tone.wav"></video><div style="display:grid;grid-template-columns:200px 200px;gap:10px"><a href="https://www.youtube.com/watch?v=one" style="height:60px">First video</a><a href="https://www.youtube.com/watch?v=two" style="height:60px">Second video</a><a href="https://www.youtube.com/watch?v=three" style="height:60px">Third video</a><a href="https://www.youtube.com/watch?v=one">First duplicate</a></div></body></html>`);});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let connection;
  try {
    connection=await connectBrowser({headless:process.env.PIHU_MCP_TEST_HEADED !== '1',profile});
    const client=connection.client;


    await perform(client,{action:'navigate',url:`http://127.0.0.1:${server.address().port}`});


    const snapshot=await perform(client,{action:'snapshot'});
    const ref=snapshot.snapshot.match(/textbox "Search" \[ref=(e\d+)\]/)?.[1];
    assert.ok(ref,snapshot.snapshot);


    await perform(client,{action:'type',ref,text:'learn Python'});
    assert.equal(await evaluate(client,()=>document.querySelector('input').value),'learn Python');


    await perform(client,{action:'click',label:'Click me'});
    assert.equal(await evaluate(client,()=>document.querySelector('button').textContent),'Clicked');


    await perform(client,{action:'click',label:'interactive count button'});
    await perform(client,{action:'click',label:'interactive count'});
    await perform(client,{action:'click',label:'interactive counter by doing'});
    assert.equal(await evaluate(client,()=>document.querySelector('#counter').textContent),'Interactive Count: 3');

    const repeated=await perform(client,{action:'click',label:'interactive count button',count:10});
    assert.equal(repeated.clicks,10);
    assert.equal(await evaluate(client,()=>document.querySelector('#counter').textContent),'Interactive Count: 13');
    await assert.rejects(()=>perform(client,{action:'click',label:'interactive count',count:0}),/Click count/);

    const videos=await perform(client,{action:'videos'});
    assert.equal(videos.items.length,3);
    assert.equal(videos.items[2].title,'Third video');
    assert.equal((await perform(client,{action:'play'})).paused,false);
    assert.equal((await perform(client,{action:'pause'})).paused,true);
    assert.equal((await perform(client,{action:'volume',value:35})).volume,35);
    assert.equal((await perform(client,{action:'unmute'})).muted,false);
    assert.ok((await perform(client,{action:'tabs'})).tabs);
    await assert.rejects(()=>perform(client,{action:'volume',value:150}),/Volume/);
    await assert.rejects(()=>perform(client,{action:'navigate',url:'file:///etc/passwd'}),/HTTP/);
  } finally {


    if(connection)await connection.close();
    await new Promise(r=>server.close(r));
    await rm(profile,{recursive:true,force:true});
  }
});

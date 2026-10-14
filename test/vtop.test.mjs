import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {chromium} from '../bin/browser-runtime/node_modules/playwright/index.mjs';
import {VtopWorkflow} from '../bin/browser-runtime/vtop.mjs';

test('VTOP workflow pauses for CAPTCHA, preserves original tab, verifies OTP and rejects wrong origin', {timeout:45000},async()=>{
  const server=createServer((req,res)=>{
    res.setHeader('content-type','text/html');
    res.end(`<form id="login"><input placeholder="Username"><input type="password" placeholder="Password"><input placeholder="Enter CAPTCHA shown above"><button>Submit</button></form><script>
      document.querySelector('form').onsubmit=e=>{
        e.preventDefault();
        document.body.innerHTML='<input placeholder="Enter OTP sent to your email"><button id="verify">Verify OTP</button>';
        document.querySelector('#verify').onclick=()=>{
          if(document.querySelector('input').value==='005998')document.body.innerHTML='<button>Logout</button>';
        };
      };
    </script>`);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const profile=await mkdtemp(path.join(tmpdir(),'pihu-vtop-test-'));
  let context;
  try {
    context=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true});
    const origin=`http://127.0.0.1:${server.address().port}`;
    const workflow=new VtopWorkflow(async()=>context,origin);
    assert.equal((await workflow.begin({username:'fixture-user',password:'fixture-password'})).stage,'captcha');
    await assert.rejects(()=>workflow.prepare(),/Enter the CAPTCHA/);
    await workflow.page.getByPlaceholder('Enter CAPTCHA shown above').fill('manual-fixture');
    assert.equal((await workflow.prepare()).stage,'otp');
    await context.newPage(); // unrelated tab must never receive the OTP
    assert.equal((await workflow.verify({otp:'005998'})).stage,'complete');
    assert.ok(await workflow.page.getByText('Logout',{exact:true}).isVisible());
    await workflow.page.goto('about:blank');
    await assert.rejects(()=>workflow.verify({otp:'005998'}),/expected site|Invalid URL/);
  } finally {
    if(context)await context.close();
    await new Promise(r=>server.close(r));
    await rm(profile,{recursive:true,force:true});
  }
});

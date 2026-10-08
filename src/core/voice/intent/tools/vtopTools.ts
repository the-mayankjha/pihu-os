import { invoke } from '@tauri-apps/api/core';
import { runGoogleApiClient } from './googleWorkspaceTools';
import { rememberTarget } from '../../../automation/targetContext';
import type { ActionTool, ToolResult } from './types';
let busy = false;
export async function runVtop(action: string): Promise<ToolResult> {
  if (busy) return {success:false,error:'A VTOP action is already running.'};
  busy=true;
  try {
    if(action==='setup') {
      await invoke('vtop_credentials',{setup:true});
      return {success:true,data:{message:'VTOP credentials saved in macOS Keychain. Say Open VTOP to begin.'}};
    }
    if(action==='open') {
      const credentials = await invoke<Record<string,string>>('vtop_credentials',{setup:false});
      const data = await invoke('browser_mcp_action',{payload:{action:'vtop_start',...credentials}});
      rememberTarget('Google Chrome');
      return {success:true,data};
    }
    if(action!=='continue')throw new Error('Use setup, open, or continue.');
    const stage = await invoke<{since:number}>('browser_mcp_action',{payload:{action:'vtop_prepare'}});
    for(let attempt=0;attempt<3;attempt++) {
      const result = await runGoogleApiClient('vtop_otp',String(stage.since));
      if(result.error)throw new Error(result.error);
      if(result.otp) {
        const data = await invoke('browser_mcp_action',{payload:{action:'vtop_verify',otp:result.otp}});
        return {success:true,data};
      }
      if(attempt<2)await new Promise(resolve=>setTimeout(resolve,2000));
    }
    return {success:false,error:'A fresh VTOP OTP has not arrived in the connected Gmail account. Say Continue VTOP to retry before it expires.'};
  } catch(error) { return {success:false,error:String(error)}; }
  finally {busy=false;}
}
export const vtopTools: ActionTool[] = [{
  declaration:{name:'vtop_login',description:'Saved VTOP login workflow. setup shows native credential prompts and saves to macOS Keychain; open fills credentials and pauses for manual CAPTCHA; continue submits the user-entered CAPTCHA, reads a fresh VTOP OTP from connected Gmail, verifies it and checks login success. Never ask for passwords or OTPs in chat.',parameters:{type:'OBJECT',properties:{action:{type:'STRING',enum:['setup','open','continue']}},required:['action']}},
  execute:args=>runVtop(args.action),
}];

const ORIGIN = 'https://vtop.vitap.ac.in';
export class VtopWorkflow {
  constructor(getContext, origin=ORIGIN, selectPage=async()=>{}) { this.selectPage=selectPage; this.getContext=getContext; this.origin=origin; this.page=null; this.requestedAt=0; }
  async check() {
    if(!this.page || this.page.isClosed())throw Error('Open VTOP first; its login tab is unavailable.');
    if(new URL(this.page.url()).origin!==this.origin)throw Error('VTOP tab left the expected site. Start the login again.');
  }
  async begin({username,password}) {
    if(typeof username!=='string'||!username.trim()||typeof password!=='string'||!password)throw Error('Saved VTOP credentials are missing.');
    const context=await this.getContext();
    if(!this.page||this.page.isClosed())this.page=await context.newPage();
    await this.page.goto(this.origin+'/vtop/login',{waitUntil:'domcontentloaded',timeout:20000});
    await this.check();
    await this.selectPage(this.page);
    await this.page.getByPlaceholder('Username',{exact:true}).fill(username);
    await this.page.getByPlaceholder('Password',{exact:true}).fill(password);
    this.requestedAt=Date.now();
    await this.page.bringToFront();
    return {stage:'captcha',message:'VTOP login is ready. Enter the CAPTCHA in the browser, then say Continue VTOP.'};
  }
  async prepare() {
    await this.check();
    const otp=this.page.getByPlaceholder('Enter OTP sent to your email',{exact:true});
    if(!await otp.isVisible()) {
      const captcha=this.page.getByPlaceholder('Enter CAPTCHA shown above',{exact:true});
      if(!await captcha.isVisible()||!(await captcha.inputValue()).trim())throw Error('Enter the CAPTCHA in the VTOP tab, then say Continue VTOP.');
      this.requestedAt=Date.now();
      await this.page.getByRole('button',{name:'Submit',exact:true}).click();
      await otp.waitFor({state:'visible',timeout:15000}).catch(()=>{throw Error('VTOP did not request an OTP. Check the CAPTCHA or login details and retry.');});
    }
    return {stage:'otp',since:this.requestedAt,message:'VTOP is waiting for its email OTP.'};
  }
  async verify({otp}) {
    await this.check();
    if(typeof otp!=='string'||!/^\d{6}$/.test(otp))throw Error('A six-digit VTOP OTP is required.');
    if(Date.now()-this.requestedAt>180000)throw Error('This login attempt expired. Say Open VTOP to start again.');
    await this.page.getByPlaceholder('Enter OTP sent to your email',{exact:true}).fill(otp);
    await this.page.getByRole('button',{name:'Verify OTP',exact:true}).click();
    try {
      await this.page.waitForFunction(()=>!document.querySelector('input[placeholder="Enter OTP sent to your email"]') &&
        !document.querySelector('input[placeholder="Password"]') &&
        /(?:logout|sign out)/i.test(document.body.innerText),null,{timeout:12000});
    } catch {
      await this.page.getByPlaceholder('Enter OTP sent to your email',{exact:true}).fill('').catch(()=>{});
      throw Error('VTOP login was not confirmed. Check the page for an expired OTP or another login error.');
    }
    await this.check();
    return {stage:'complete',message:'VTOP login succeeded.'};
  }
}

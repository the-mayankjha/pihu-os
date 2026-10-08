# VTOP login

Restart Pihu after installing this change. Connect the Gmail account that receives your VTOP emails in Pihu Settings.

1. Say **Set up VTOP**. Enter your username and password in the native macOS prompts. Pihu saves them in the login Keychain, outside chat and settings.
2. Say **Open VTOP**. Pihu opens its controlled Chrome login tab and fills the saved credentials.
3. Enter the CAPTCHA yourself in that tab. Say **Continue VTOP**. You may also submit the CAPTCHA manually before continuing.
4. Pihu reads a fresh Gmail message from `noreply.sdc@vitap.ac.in` with subject `VTOP Login OTP Needed`, fills its six-digit OTP in the original VTOP tab, and verifies login.

If mail has not arrived, say **Continue VTOP** again within three minutes. If the attempt expires, say **Open VTOP** to restart. Say **Set up VTOP** again to replace saved credentials. macOS may request permission for Keychain access.

The workflow never solves CAPTCHA automatically. OTPs preserve leading zeros and are not returned in assistant responses. Only fresh matching messages are considered; unrelated email contents are not returned. Login success requires disappearance of the login fields and a visible logout/sign-out indicator.

Local mock login and Gmail tests cover the workflow. Live university login still requires your credentials, manual CAPTCHA entry, and the matching connected Gmail account.

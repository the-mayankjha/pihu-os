import importlib.util, pathlib, unittest, base64, time
spec=importlib.util.spec_from_file_location('google_api_client',pathlib.Path(__file__).parents[1]/'src-tauri/pihu_mcps/mcp/servers/google_api_client.py')
client=importlib.util.module_from_spec(spec)
spec.loader.exec_module(client)

class VtopOtpTests(unittest.TestCase):
    def message(self, code='0 0 5 9 9 8', age=0, sender='noreply.sdc@vitap.ac.in'):
        return {'internalDate':str(int(time.time()*1000)-age),'payload':{'mimeType':'text/html','headers':[{'name':'From','value':sender},{'name':'Subject','value':'VTOP Login OTP Needed'}],'body':{'data':base64.urlsafe_b64encode(('<p>Your one-time password</p><b>'+code+'</b>').encode()).decode()}}}
    def run_lookup(self, message, since):
        client.make_google_api_request=lambda url, **kwargs: message if 'format=full' in url else {'messages':[{'id':'fixture'}]}
        return client.vtop_otp(since)
    def test_preserves_leading_zeros(self):
        self.assertEqual(self.run_lookup(self.message(),int(time.time()*1000)-1000)['otp'],'005998')
    def test_ignores_old_message(self):
        self.assertTrue(self.run_lookup(self.message(age=60000),int(time.time()*1000)-1000)['pending'])
    def test_ignores_wrong_sender(self):
        self.assertTrue(self.run_lookup(self.message(sender='other@example.com'),int(time.time()*1000)-1000)['pending'])
    def test_rejects_ambiguous_codes(self):
        self.assertTrue(self.run_lookup(self.message('123456 or 654321'),int(time.time()*1000)-1000)['pending'])
    def test_expired_attempt(self):
        self.assertIn('error',client.vtop_otp(int(time.time()*1000)-181000))
if __name__=='__main__': unittest.main()

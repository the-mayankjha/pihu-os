import importlib.util, pathlib, unittest, tempfile, threading, urllib.request, urllib.error, urllib.parse, json, io, os
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('google_oauth',pathlib.Path(__file__).parents[1]/'src-tauri/pihu_mcps/mcp/servers/google_oauth_server.py')
oauth=importlib.util.module_from_spec(spec)
spec.loader.exec_module(oauth)

class OAuthTests(unittest.TestCase):
    def test_callback_branding_theme_and_escaped_account(self):
        page=oauth.render_callback(200,'Connected','<script>test</script>')
        self.assertIn('prefers-color-scheme:dark',page)
        self.assertIn('PIHU',page)
        self.assertIn('data:image/png;base64,',page)
        self.assertIn('&lt;script&gt;test&lt;/script&gt;',page)
        self.assertIn('Let’s try that again.',oauth.render_callback(400,'Cancelled'))

    def test_account_refresh_token_preserved_per_email(self):
        with tempfile.TemporaryDirectory() as folder:
            path=os.path.join(folder,'tokens.json')
            config={'client_id':'test-client','client_secret':'test-secret'}
            oauth.save_account(path,config,{'access_token':'one','refresh_token':'refresh-one'},{'email':'one@example.com'})
            oauth.save_account(path,config,{'access_token':'two','refresh_token':'refresh-two'},{'email':'two@example.com'})
            account=oauth.save_account(path,config,{'access_token':'new-one'},{'email':'one@example.com'})
            self.assertEqual(account['refresh_token'],'refresh-one')
            self.assertEqual(os.stat(path).st_mode & 0o777,0o600)
    def test_listener_and_callback_use_same_free_port_with_state(self):
        with tempfile.TemporaryDirectory() as folder:
            path=os.path.join(folder,'tokens.json')
            server=oauth.create_server({'client_id':'test-client','client_secret':'test-secret'},token_path=path)
            self.assertNotEqual(server.server_port,8080)
            self.assertEqual(server.server_address[0],'127.0.0.1')
            query=urllib.parse.parse_qs(urllib.parse.urlparse(server.auth_url).query)
            self.assertEqual(query['redirect_uri'][0],server.redirect_uri)
            self.assertEqual(query['state'][0],server.state)
            thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
            real_open=urllib.request.urlopen
            try:
                with self.assertRaises(urllib.error.HTTPError) as result:
                    real_open(server.redirect_uri+'?code=test&state=wrong',timeout=2)
                self.assertEqual(result.exception.code,400)
                self.assertFalse(os.path.exists(path))
                exchanges=[]
                def fake_open(request,**kwargs):
                    if request.full_url=='https://oauth2.googleapis.com/token':
                        exchanges.append(urllib.parse.parse_qs(request.data.decode()))
                        return io.BytesIO(json.dumps({'access_token':'fixture-access','refresh_token':'fixture-refresh'}).encode())
                    return io.BytesIO(json.dumps({'email':'fixture@example.com','name':'Fixture'}).encode())
                with patch.object(oauth.urllib.request,'urlopen',fake_open):
                    with real_open(server.redirect_uri+'?code=fixture&state='+server.state,timeout=3) as response:
                        self.assertEqual(response.status,200)
                        self.assertIn(b"PIHU",response.read())
                self.assertEqual(exchanges[0]['redirect_uri'][0],server.redirect_uri)
                self.assertTrue(os.path.exists(path))
            finally:
                server.shutdown();server.server_close();thread.join(timeout=2)
if __name__=='__main__':unittest.main()

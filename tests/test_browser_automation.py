import unittest
from unittest.mock import patch
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src-tauri/python/automations/macos/pihu-macos-automation-v2'))
from pihu_automation.macos.browser_actions import perform_browser, script, SCRIPT
from types import SimpleNamespace
import subprocess
class Tests(unittest.TestCase):
    def test_current_youtube_search_is_encoded_and_uses_argv(self):
        with patch('pihu_automation.macos.browser_actions.current_page', return_value={'app':'Safari','url':'https://www.youtube.com/'}), patch('pihu_automation.macos.browser_actions.subprocess.run', return_value=SimpleNamespace(returncode=0,stderr='')) as run:
            result = perform_browser({'browser_action':'search','app':'Safari','query':'cats & dogs $(echo hi)'})
            self.assertIn('youtube.com/results?search_query=cats%20%26%20dogs',result['url'])
            self.assertEqual(run.call_args.args[0][:3], ['/usr/bin/open','-a','Safari'])
    def test_explicit_google_overrides_current_youtube(self):
        with patch('pihu_automation.macos.browser_actions.current_page', return_value={'app':'Safari','url':'https://www.youtube.com/'}), patch('pihu_automation.macos.browser_actions.subprocess.run', return_value=SimpleNamespace(returncode=0,stderr='')):
            result = perform_browser({'browser_action':'search','app':'Safari','site':'google','query':'test'})
            self.assertIn('google.com/search', result['url'])
    def test_invalid_volume_and_unconfirmed_fullscreen(self):
        with self.assertRaises(ValueError): perform_browser({'browser_action':'volume','value':101})
        with patch('pihu_automation.macos.browser_actions.script', return_value={'fullscreen':False}):
            with self.assertRaises(RuntimeError): perform_browser({'browser_action':'fullscreen'})
    def test_timeout_does_not_speak_script_source(self):
        with patch('pihu_automation.macos.browser_actions.subprocess.run', side_effect=subprocess.TimeoutExpired('osascript',9)):
            with self.assertRaisesRegex(RuntimeError,'Automation permission') as error: script({'action':'state'})
            self.assertNotIn(SCRIPT, str(error.exception))

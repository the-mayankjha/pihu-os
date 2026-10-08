import sys
import unittest
from unittest.mock import Mock, patch
from types import SimpleNamespace
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src-tauri/python/automations/macos/pihu-macos-automation-v2'))
from pihu_automation.macos.ui_actions import candidates, choose, perform_ui
from pihu_automation.macos.accessibility import AX
class Backend:
    def __init__(self): self.calls = []
    def target(self, pid): return 1, 2
    def bounds(self, ref): return [0, 0, 100, 100]
    def inspect(self, ref):
        return [dict(ref=3, role='AXLink', label='YouTube', bounds=[10, 10, 40, 20], url='https://youtube.com', result=True), dict(ref=4, role='AXScrollArea', label='', bounds=[0, 0, 100, 100])], False
    def focus(self, *args): self.calls.append('focus')
    def press(self, ref): self.calls.append(ref)
    def scroll(self, *args): self.calls.append(args)
class Tests(unittest.TestCase):
    def test_foreground_pid_fallback(self):
        ax = AX.__new__(AX)
        ax.system = 1
        ax.ax = SimpleNamespace(AXIsProcessTrusted=lambda: True,
                                AXUIElementCreateApplication=Mock(return_value=20),
                                AXUIElementSetMessagingTimeout=Mock())
        ax.keep = lambda ref: ref
        ax.copy = lambda ref, key: 30 if key == 'AXFocusedWindow' else None
        with patch('pihu_automation.macos.accessibility.frontmost_pid', return_value=123):
            self.assertEqual(ax.target(), (20, 30))
        ax.ax.AXUIElementCreateApplication.assert_called_once_with(123)
    def test_domain_match_is_exact_and_ambiguous_domains_fail(self):
        link = dict(role='AXLink', label='YouTube', url='https://www.youtube.com/watch?v=1')
        self.assertIs(choose([link], 'youtube.com'), link)
        with self.assertRaises(ValueError): choose([link, dict(link)], 'youtube.com')
        with self.assertRaises(ValueError): choose([link], 'youtube.com.evil.example')
    def test_video_candidates_ignore_navigation_and_duplicate_thumbnails(self):
        nodes = [dict(role='AXLink', label='Python', url='https://www.youtube.com/watch?v=123', bounds=[0,0,40,20]),
                 dict(role='AXLink', label='Thumbnail', url='https://www.youtube.com/watch?v=123', bounds=[0,0,40,20]),
                 dict(role='AXLink', label='Home', url='https://www.youtube.com/', bounds=[0,0,40,20])]
        self.assertEqual(len(candidates(nodes, [0,0,100,100], 'video')), 1)
    def test_playback_success_and_errors(self):
        from pihu_automation.macos.playback import play_video
        with patch('pihu_automation.macos.playback.subprocess.run', return_value=SimpleNamespace(returncode=0, stdout='Video playback started.', stderr='')) as run:
            self.assertEqual(play_video('Safari')['message'], 'Video playback started.')
            self.assertEqual(run.call_args.args[0][-1], 'Safari')
        with patch('pihu_automation.macos.playback.subprocess.run', return_value=SimpleNamespace(returncode=1, stdout='', stderr='JavaScript disabled')):
            with self.assertRaisesRegex(RuntimeError, 'playback failed'):
                play_video('Safari')
    def test_combined_search_label_matches_complete_title(self):
        first = dict(role='AXLink', result=True, label='YouTube\n\nYouTube https://www.youtube.com')
        second = dict(role='AXLink', result=True, label='YouTube\n\nGoogle Accounts https://accounts.google.com')
        self.assertIs(choose([first, second], 'YouTube', first_result=True), first)
        self.assertIs(choose([first, second], 'YouTube', index=2, first_result=True), second)
        with self.assertRaises(ValueError): choose([first], 'Tube', first_result=True)
        with self.assertRaises(ValueError): choose([dict(role='AXButton', label='YouTube'), dict(role='AXButton', label='YouTube')], 'YouTube', first_result=True)
    def test_exact_click(self):
        ax = Backend()
        self.assertEqual(perform_ui({'action':'click','label':'YouTube'}, ax)['target']['label'], 'YouTube')
        self.assertEqual(ax.calls, ['focus', 3])
    def test_ambiguous_label_rejected(self):
        with self.assertRaises(ValueError): choose([{'label':'Play'}, {'label':'Play'}], 'Play')
    def test_offscreen_and_result_filter(self):
        nodes = Backend().inspect(2)[0]
        nodes.append(dict(role='AXLink', label='Hidden', bounds=[300, 0, 10, 10], result=True))
        self.assertEqual(len(candidates(nodes, [0,0,100,100], 'result')), 1)
    def test_scroll_and_validation(self):
        ax = Backend()
        perform_ui({'action':'scroll','direction':'down'}, ax)
        self.assertEqual(ax.calls[0][3:5], ('down', 5))
        with self.assertRaises(ValueError): perform_ui({'action':'scroll','amount':True}, ax)
    def test_incomplete_tree_cannot_click(self):
        ax = Backend()
        original = ax.inspect
        ax.inspect = lambda ref: (original(ref)[0], True)
        with self.assertRaises(RuntimeError): perform_ui({'action':'click','label':'YouTube'}, ax)
        self.assertFalse(ax.calls)
if __name__ == '__main__': unittest.main()

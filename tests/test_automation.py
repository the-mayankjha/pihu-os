"""Exercise the existing Python automation without changing the desktop."""
import sys
import subprocess
import unittest
from pathlib import Path
from unittest.mock import patch

AUTOMATION = Path(__file__).resolve().parents[1] / 'src-tauri/python/automations/macos/pihu-macos-automation-v2'
sys.path.insert(0, str(AUTOMATION))
from pihu_automation.macos.control import control
from pihu_automation.macos.windows import WindowController


class AutomationTests(unittest.TestCase):
    def test_input_is_passed_as_arguments(self):
        name = 'A "quoted" app; $(echo nope)'
        with patch('pihu_automation.macos.control.subprocess.run', return_value=subprocess.CompletedProcess([], 0, 'done', '')) as run:
            result = control(name, 'open')
            self.assertTrue(result.success)
            self.assertEqual(run.call_args.args[0][2], name)
            self.assertNotIn('shell', run.call_args.kwargs)

    def test_invalid_actions_do_not_execute(self):
        with patch('pihu_automation.macos.control.subprocess.run') as run:
            self.assertFalse(control('Safari', 'kill').success)
            self.assertFalse(control('Safari', 'resize', width=-10, height=400).success)
            self.assertFalse(control('Safari', 'move', x=100).success)
            self.assertFalse(control('Safari', 'minimize', window=0).success)
            run.assert_not_called()

    def test_permission_failure_is_reported(self):
        with patch('pihu_automation.macos.control.subprocess.run', return_value=subprocess.CompletedProcess([], 1, '', 'assistive access -1719')):
            result = control('Safari', 'minimize')
            self.assertFalse(result.success)
            self.assertIn('Accessibility', result.stderr)

    def test_timeout_does_not_claim_success(self):
        with patch('pihu_automation.macos.control.subprocess.run', side_effect=subprocess.TimeoutExpired('osascript', 12)):
            result = control('Safari', 'quit')
            self.assertFalse(result.success)
            self.assertEqual(result.code, 124)

    def test_window_index_and_aliases_reach_shared_controller(self):
        with patch('pihu_automation.macos.control.subprocess.run', return_value=subprocess.CompletedProcess([], 0, 'restored', '')) as run:
            self.assertTrue(WindowController().restore('vscode', window=2).success)
            self.assertEqual(run.call_args.args[0][2:5], ['Visual Studio Code', 'restore', '2'])


if __name__ == '__main__':
    unittest.main()

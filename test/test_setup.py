"""Installer control-flow tests; never install packages or fetch models."""
import importlib.util
import io
import subprocess
import tempfile
import unittest
from contextlib import redirect_stdout, redirect_stderr
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('pihu_setup', Path(__file__).resolve().parents[1] / 'setup.py')
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


class Response(io.BytesIO):
    def __init__(self, data, length=None):
        super().__init__(data)
        self.headers = {'Content-Length': str(length if length is not None else len(data))}


class SetupTests(unittest.TestCase):
    def test_check_never_installs(self):
        with patch.object(setup, 'check_prerequisites'), patch.object(setup, 'verify_build_dependencies'), \
             patch.object(setup, 'verify') as verify, \
             patch.object(setup, 'setup_system_dependencies') as system, \
             patch.object(setup, 'setup_frontend') as frontend, \
             patch.object(setup, 'setup_python_env') as python_env, \
             patch.object(setup, 'setup_modules') as modules, \
             patch.object(setup, 'setup_models') as models, \
             patch.object(setup, 'setup_native') as native:
            self.assertEqual(setup.main(['--check']), 0)
            verify.assert_called_once()
            for step in (system, frontend, python_env, modules, models, native):
                step.assert_not_called()

    def test_failure_stops_setup_and_returns_nonzero(self):
        with patch.object(setup, 'check_prerequisites'), \
             patch.object(setup, 'setup_system_dependencies'), \
             patch.object(setup, 'setup_frontend', side_effect=setup.SetupError('failed')), \
             patch.object(setup, 'setup_python_env') as python_env:
            self.assertEqual(setup.main([]), 1)
            python_env.assert_not_called()

    def test_subprocess_uses_argv_and_project_root(self):
        with patch.object(setup.subprocess, 'run') as run:
            setup.run_command(['python', '-c', 'print("$literal; text")'])
            self.assertEqual(run.call_args.args[0], ['python', '-c', 'print("$literal; text")'])
            self.assertNotIn('shell', run.call_args.kwargs)
            self.assertEqual(run.call_args.kwargs['cwd'], setup.ROOT)

    def test_subprocess_errors_propagate(self):
        with patch.object(setup.subprocess, 'run', side_effect=subprocess.CalledProcessError(1, ['pip'])):
            with self.assertRaises(setup.SetupError):
                setup.run_command(['pip', 'install', 'missing'])

    def test_download_is_atomic_and_reused(self):
        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory) / 'model.bin'
            with patch.object(setup.urllib.request, 'urlopen', return_value=Response(b'x' * 2048)) as fetch:
                setup.download_model('https://example.com/model.bin', destination)
                self.assertEqual(destination.read_bytes(), b'x' * 2048)
                setup.download_model('https://example.com/model.bin', destination)
                self.assertEqual(fetch.call_count, 1)
            self.assertFalse(destination.with_suffix('.bin.part').exists())

    def test_truncated_download_does_not_replace_model(self):
        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory) / 'model.bin'
            with patch.object(setup.urllib.request, 'urlopen', return_value=Response(b'x' * 2048, 4096)):
                with self.assertRaises(setup.SetupError):
                    setup.download_model('https://example.com/model.bin', destination)
            self.assertFalse(destination.exists())
            self.assertFalse(destination.with_suffix('.bin.part').exists())

    def test_lfs_pointer_is_replaced(self):
        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory) / 'model.bin'
            destination.write_bytes(b'version https://git-lfs.github.com/spec/v1\n' + b'x' * 2048)
            with patch.object(setup.urllib.request, 'urlopen', return_value=Response(b'y' * 2048)):
                setup.download_model('https://example.com/model.bin', destination)
            self.assertEqual(destination.read_bytes(), b'y' * 2048)

    def test_hosted_wake_models_include_companion_weights(self):
        with tempfile.TemporaryDirectory() as directory, \
             patch.object(setup, 'WAKE_DIR', Path(directory)), \
             patch.object(setup, 'download_model') as download, patch.object(setup, 'run_command') as run:
            setup.setup_models(Path('python'), 'small')
            for filename in (*setup.CUSTOM_WAKE, *setup.WAKE_DATA, *setup.BASE_WAKE):
                download.assert_any_call(
                    f'https://models.pihu.nfks.co.in/wakeWord/{filename}',
                    Path(directory) / filename)
            self.assertEqual(download.call_count, 11)  # Ten wake assets plus Whisper.
            self.assertEqual(run.call_count, 2)

    def test_skip_flags_limit_verification(self):
        with patch.object(setup, 'check_prerequisites'), patch.object(setup, 'verify_build_dependencies'), \
             patch.object(setup, 'verify') as verify:
            setup.main(['--check', '--skip-models', '--skip-native', '--skip-modules'])
            self.assertEqual(verify.call_args.args[2:], (False, False, False))


if __name__ == '__main__':
    with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
        unittest.main()

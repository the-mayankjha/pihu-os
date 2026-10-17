"""Keep eSpeak data paths below the native library's fixed-size path buffer."""
import atexit
import os
from pathlib import Path
import shutil
import sys
import tempfile

_data_path = None

def configure_espeak(runtime=None):
    global _data_path
    import espeakng_loader
    if _data_path is None:
        runtime = Path(runtime) if runtime else Path(sys.prefix).parent
        source = runtime / 'espeak-ng-data'
        if not source.is_dir():
            source = Path(espeakng_loader.__file__).parent / 'espeak-ng-data'
        if not (source / 'phontab').is_file():
            raise RuntimeError('Bundled eSpeak phoneme data is missing')
        source = source.resolve()
        if len(os.fsencode(str(source))) > 140:
            # Symlinks do not help: phonemizer resolves them before calling C.
            # A private temporary copy also supports long/non-ASCII install paths.
            temporary = Path(tempfile.mkdtemp(prefix='pihu-espeak-'))
            atexit.register(shutil.rmtree, temporary, ignore_errors=True)
            source_copy = temporary / 'espeak-ng-data'
            if len(os.fsencode(str(source_copy))) > 140:
                raise RuntimeError('eSpeak needs a shorter temporary directory; configure TMPDIR/TEMP')
            shutil.copytree(source, source_copy)
            source = source_copy
        _data_path = str(source)
    # Misaki also calls this loader; make every pipeline use the same safe path.
    espeakng_loader.get_data_path = lambda: _data_path
    from phonemizer.backend.espeak.wrapper import EspeakWrapper
    EspeakWrapper.set_library(espeakng_loader.get_library_path())
    EspeakWrapper.set_data_path(_data_path)
    return _data_path

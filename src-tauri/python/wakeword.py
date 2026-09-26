import os
import sys
import pyaudio
import numpy as np
from openwakeword.model import Model

# Resolve absolute paths to the custom ONNX models with fallback discovery
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
candidate_dirs = [
    os.path.abspath(os.path.join(BASE_DIR, '../../models/wakeWord')),
    os.path.abspath(os.path.join(BASE_DIR, '../models/wakeWord')),
    os.path.abspath('models/wakeWord'),
]

MODELS_DIR = next((d for d in candidate_dirs if os.path.isdir(d)), candidate_dirs[0])

MODEL_FILES = [
    'pihu.onnx',
    'hey_pihu.onnx',
    'hi_pihu.onnx',
    'Gen-pihu.onnx'
]

model_paths = []
for f in MODEL_FILES:
    p = os.path.join(MODELS_DIR, f)
    if os.path.exists(p):
        model_paths.append(p)

if not model_paths:
    print(f"WAKEWORD_ERROR: No models found in {MODELS_DIR}!")
    sys.stdout.flush()
    sys.exit(1)

print(f"WAKEWORD_INFO: Loading {len(model_paths)} models from {MODELS_DIR}...")
sys.stdout.flush()

try:
    # Initialize the openwakeword model
    owwModel = Model(wakeword_models=model_paths, inference_framework="onnx")
except Exception as e:
    print(f"WAKEWORD_ERROR: Failed to load models: {e}")
    sys.stdout.flush()
    sys.exit(1)

# PyAudio Configuration
FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 16000
CHUNK = 512

audio = pyaudio.PyAudio()

try:
    stream = audio.open(format=FORMAT, channels=CHANNELS, rate=RATE, input=True, frames_per_buffer=CHUNK)
except Exception as e:
    print(f"WAKEWORD_ERROR: Could not open microphone: {e}")
    sys.stdout.flush()
    sys.exit(1)

import time
import math
import onnxruntime as ort
import threading

print("WAKEWORD_READY")
sys.stdout.flush()

# Start background thread to listen for manual trigger commands
def listen_stdin():
    global mode, silence_frames, total_listening_frames, vad_state, speech_detected_in_session
    while True:
        line = sys.stdin.readline()
        if not line:
            print("WAKEWORD_INFO: stdin closed. Parent died. Exiting.")
            os._exit(0)
        line = line.strip()
        if line == "START_LISTENING":
            print("WAKEWORD_INFO: Manual trigger received from Tauri. Entering LISTENING mode.")
            sys.stdout.flush()
            mode = "LISTENING"
            silence_frames = 0
            total_listening_frames = 0
            speech_detected_in_session = False
            vad_state = np.zeros((2, 1, 128), dtype=np.float32)
            for m in owwModel.models.keys():
                owwModel.prediction_buffer[m].clear()
            try:
                if stream.is_active():
                    stream.stop_stream()
            except Exception:
                pass
        elif line == "SPEECH_DONE" or line == "RESUME_WAKEWORD":
            print(f"WAKEWORD_INFO: {line} received. Resuming wake word detection.")
            sys.stdout.flush()
            mode = "WAKEWORD"
            for m in owwModel.models.keys():
                owwModel.prediction_buffer[m].clear()
            try:
                if not stream.is_active():
                    stream.start_stream()
            except Exception as e:
                print(f"WAKEWORD_ERROR restarting stream: {e}", file=sys.stderr)
                sys.stderr.flush()

threading.Thread(target=listen_stdin, daemon=True).start()


# Initialize Silero VAD ONNX
VAD_MODEL_PATH = os.path.abspath(os.path.join(MODELS_DIR, 'silero_vad.onnx'))
try:
    vad_sess = ort.InferenceSession(VAD_MODEL_PATH)
    vad_sr = np.array(16000, dtype=np.int64)
    print("WAKEWORD_INFO: Silero VAD loaded successfully.")
    sys.stdout.flush()
except Exception as e:
    print(f"WAKEWORD_ERROR: Failed to load Silero VAD: {e}")
    sys.stdout.flush()
    sys.exit(1)

mode = "WAKEWORD" # Modes: WAKEWORD, LISTENING
total_listening_frames = 0
MAX_LISTENING_FRAMES = int((16000 / CHUNK) * 60)  # 60 seconds max per session
silence_frames = 0
SILENCE_PROB_THRESHOLD = 0.5  # Silero VAD probability threshold
FRAMES_FOR_SILENCE_AFTER_SPEECH = int((16000 / CHUNK) * 1.5)  # 1.5 seconds of silence after speech
FRAMES_FOR_IDLE_TIMEOUT = int((16000 / CHUNK) * 5.0)  # 5 seconds of silence to sleep
vad_state = np.zeros((2, 1, 128), dtype=np.float32)
speech_detected_in_session = False

while True:
    try:
        if mode == "WAKEWORD":
            if not stream.is_active():
                try:
                    stream.start_stream()
                except Exception:
                    pass
            data = stream.read(CHUNK, exception_on_overflow=False)
            np_data = np.frombuffer(data, dtype=np.int16)
            prediction = owwModel.predict(np_data)
            for model_name, score in prediction.items():
                if score > 0.45:
                    print(f"WAKEWORD_DETECTED: {model_name}")
                    sys.stdout.flush()
                    for m in owwModel.models.keys():
                        owwModel.prediction_buffer[m].clear()
                    
                    # Switch to LISTENING mode
                    mode = "LISTENING"
                    silence_frames = 0
                    total_listening_frames = 0
                    speech_detected_in_session = False
                    vad_state = np.zeros((2, 1, 128), dtype=np.float32)

                    try:
                        if stream.is_active():
                            stream.stop_stream()
                    except Exception:
                        pass
                    break

        elif mode == "LISTENING":
            import time as _time
            _time.sleep(0.05)
                    
    except KeyboardInterrupt:
        break
    except Exception as e:
        print(f"WAKEWORD_ERROR: {e}", file=sys.stderr)
        sys.stderr.flush()
        import time as _time
        _time.sleep(0.5)
        try:
            if mode == "WAKEWORD" and not stream.is_active():
                stream.start_stream()
        except Exception:
            pass
        continue

try:
    stream.stop_stream()
    stream.close()
    audio.terminate()
except Exception:
    pass


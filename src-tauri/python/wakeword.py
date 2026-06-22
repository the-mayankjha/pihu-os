import os
import sys
import pyaudio
import numpy as np
from openwakeword.model import Model

# Resolve absolute paths to the custom ONNX models
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.abspath(os.path.join(BASE_DIR, '../../models/wakeWord'))

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
    print("WAKEWORD_ERROR: No models found!")
    sys.stdout.flush()
    sys.exit(1)

print(f"WAKEWORD_INFO: Loading {len(model_paths)} models...")
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
            # Ensure stream is paused so browser can capture the mic
            try:
                stream.stop_stream()
            except Exception:
                pass
        elif line == "SPEECH_DONE":
            # Frontend signals that STT has finished capturing — resume PyAudio
            print("WAKEWORD_INFO: SPEECH_DONE received. Resuming wake word detection.")
            sys.stdout.flush()
            mode = "WAKEWORD"
            try:
                stream.start_stream()
            except Exception:
                pass

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
            data = stream.read(CHUNK, exception_on_overflow=False)
            np_data = np.frombuffer(data, dtype=np.int16)
            prediction = owwModel.predict(np_data)
            for model_name, score in prediction.items():
                if score > 0.8:
                    print(f"WAKEWORD_DETECTED: {model_name}")
                    sys.stdout.flush()
                    owwModel.prediction_buffer[model_name].clear()
                    
                    # Switch to LISTENING mode
                    mode = "LISTENING"
                    silence_frames = 0
                    total_listening_frames = 0
                    speech_detected_in_session = False
                    vad_state = np.zeros((2, 1, 128), dtype=np.float32)

                    # CRITICAL: Stop the PyAudio stream so the browser's getUserMedia
                    # can exclusively capture the microphone for STT.
                    # If both compete for the mic simultaneously, the browser gets silence.
                    stream.stop_stream()
                    break

        elif mode == "LISTENING":
            # The browser's STTManager exclusively captures the mic and runs its own VAD.
            # We simply idle here until the frontend sends SPEECH_DONE via stdin,
            # which causes the listen_stdin thread to call stream.start_stream() and
            # set mode = "WAKEWORD".
            import time as _time
            _time.sleep(0.05)  # 50ms idle poll — no CPU burn

                    
    except KeyboardInterrupt:
        break
    except Exception as e:
        print(f"WAKEWORD_ERROR: {e}", file=sys.stderr)
        # Try to recover the stream
        try:
            stream.start_stream()
        except Exception:
            pass
        break

stream.stop_stream()
stream.close()
audio.terminate()


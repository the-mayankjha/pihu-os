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
CHUNK = 1280

audio = pyaudio.PyAudio()

try:
    stream = audio.open(format=FORMAT, channels=CHANNELS, rate=RATE, input=True, frames_per_buffer=CHUNK)
except Exception as e:
    print(f"WAKEWORD_ERROR: Could not open microphone: {e}")
    sys.stdout.flush()
    sys.exit(1)

import time
import math

print("WAKEWORD_READY")
sys.stdout.flush()

def get_rms(np_data):
    # Calculate root-mean-square energy of the audio chunk
    return math.sqrt(np.mean(np.square(np_data.astype(np.float32))))

mode = "WAKEWORD" # Modes: WAKEWORD, LISTENING
silence_frames = 0
SILENCE_THRESHOLD = 500  # Adjust this based on mic sensitivity
FRAMES_FOR_SILENCE = int((16000 / CHUNK) * 1.5)  # 1.5 seconds of silence

while True:
    try:
        data = stream.read(CHUNK, exception_on_overflow=False)
        np_data = np.frombuffer(data, dtype=np.int16)
        
        if mode == "WAKEWORD":
            prediction = owwModel.predict(np_data)
            for model_name, score in prediction.items():
                if score > 0.8:
                    print(f"WAKEWORD_DETECTED: {model_name}")
                    sys.stdout.flush()
                    owwModel.prediction_buffer[model_name].clear()
                    
                    # Switch to LISTENING mode
                    mode = "LISTENING"
                    silence_frames = 0
                    time.sleep(1.0) # Grace period while Orb does Wake animation
                    break

        elif mode == "LISTENING":
            rms = get_rms(np_data)
            
            if rms < SILENCE_THRESHOLD:
                silence_frames += 1
            else:
                silence_frames = 0
                
            if silence_frames > FRAMES_FOR_SILENCE:
                print("SPEECH_ENDED")
                sys.stdout.flush()
                # Reset to WAKEWORD mode
                mode = "WAKEWORD"
                
    except KeyboardInterrupt:
        break
    except Exception as e:
        print(f"WAKEWORD_ERROR: {e}", file=sys.stderr)
        break

stream.stop_stream()
stream.close()
audio.terminate()

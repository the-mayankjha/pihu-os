import os
import requests

MODELS_DIR = "src-tauri/python/venv/lib/python3.10/site-packages/openwakeword/resources/models"
os.makedirs(MODELS_DIR, exist_ok=True)

models = [
    "melspectrogram.onnx",
    "embedding_model.onnx"
]

base_url = "https://github.com/dscripka/openWakeWord/raw/main/openwakeword/resources/models/"

for model in models:
    print(f"Downloading {model}...")
    url = base_url + model
    r = requests.get(url)
    r.raise_for_status()
    with open(os.path.join(MODELS_DIR, model), "wb") as f:
        f.write(r.content)
    print(f"Saved {model}")

print("Done!")

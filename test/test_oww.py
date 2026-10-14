import openwakeword
from openwakeword.model import Model
try:
    m = Model(wakeword_models=['./models/wakeWord/pihu.onnx'], inference_framework="onnx", enable_speex_noise_suppression=True)
    print("Success")
except Exception as e:
    print(e)

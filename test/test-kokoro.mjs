import { KokoroTTS } from "kokoro-js";
const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8", device: "cpu" });
const audio = await tts.generate("Hello", { voice: "af_bella" });
console.log("Audio Object Keys:", Object.keys(audio));
if (audio.audio) {
  console.log("audio.audio exists, type:", audio.audio.constructor.name, "length:", audio.audio.length);
}
console.log("sampling rate:", audio.sampling_rate);

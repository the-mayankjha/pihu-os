"""
PIHU Voice Test Script (test_voice.py)
--------------------------------------
1. Captures voice from microphone (or test audio/text)
2. Runs Whisper STT with auto language detection (Hindi + English)
3. Normalizes transcript & detects contact/relation names using Language Bridge
4. Repeats the recognized contact name using Kokoro TTS ('hf_alpha' female voice)

Usage:
    # Run interactive voice test:
    python test_voice.py

    # Or run in text simulation mode (test without microphone):
    python test_voice.py --text "Can you message pappa saying I reached safely"
"""

import os
import sys
import re
import io
import time
import argparse
import numpy as np
import soundfile as sf

# Set path to include local modules
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

# Import Language module & Bridge
from language.contact_bridge import bridge as contact_bridge, RELATION_ALIASES
from language.speech.normalizer import SpeechNormalizer

# Kokoro & PyAudio / SoundDevice imports
try:
    from kokoro import KPipeline
    import sounddevice as sd
except ImportError as e:
    print(f"⚠️ Warning importing audio libraries: {e}")

try:
    from pywhispercpp.model import Model as WhisperModel
except ImportError:
    WhisperModel = None


class VoiceTester:
    def __init__(self, sample_rate=16000):
        self.sample_rate = sample_rate
        self.normalizer = SpeechNormalizer()
        self.stt_model = None
        self.tts_pipeline = None
        self._init_tts()
        self._init_stt()

    def _init_tts(self):
        """Initialize Kokoro TTS with Hindi pipeline and hf_alpha voice."""
        print("\n[1/2] 🔊 Initializing Kokoro TTS (Hindi pipeline, 'hf_alpha' female voice)...")
        try:
            self.tts_pipeline = KPipeline(lang_code='h')
            print("✅ Kokoro Hindi TTS Pipeline initialized successfully with 'hf_alpha'!")
        except Exception as e:
            print(f"⚠️ Hindi pipeline init failed ({e}), falling back to English pipeline...")
            try:
                self.tts_pipeline = KPipeline(lang_code='a')
                print("✅ Kokoro English TTS fallback ready.")
            except Exception as e2:
                print(f"❌ Failed to load Kokoro: {e2}")

    def _init_stt(self):
        """Initialize Whisper STT model with auto multilingual detection."""
        print("\n[2/2] 🎙️ Initializing Whisper STT (Auto Multilingual Hindi/English)...")
        if WhisperModel is None:
            print("⚠️ pywhispercpp not installed.")
            return

        project_root = os.path.dirname(os.path.dirname(CURRENT_DIR))
        models_dir = os.path.join(project_root, 'models', 'stt')
        os.makedirs(models_dir, exist_ok=True)

        candidate_files = [
            os.path.join(models_dir, 'ggml-base.bin'),
            os.path.join(models_dir, 'ggml-small.bin'),
            os.path.join(models_dir, 'ggml-base.en.bin'),
        ]

        for path in candidate_files:
            if os.path.exists(path):
                try:
                    print(f"Loading local Whisper model from {path}...")
                    self.stt_model = WhisperModel(path)
                    print("✅ Whisper STT Model loaded!")
                    return
                except Exception as e:
                    print(f"Could not load {path}: {e}")

        # Try pywhispercpp auto-download
        try:
            print("Attempting to load 'base' model via pywhispercpp...")
            self.stt_model = WhisperModel('base', models_dir=models_dir)
            print("✅ Multilingual 'base' Whisper model loaded!")
        except Exception as e:
            print(f"⚠️ STT load error: {e}")

    def record_microphone(self, duration_sec=5.0) -> np.ndarray:
        """Record audio from default mic at 16kHz float32."""
        print(f"\n🎤 Recording from microphone for {duration_sec} seconds... (SPEAK A CONTACT NAME OR MESSAGE)")
        audio_data = sd.rec(
            int(duration_sec * self.sample_rate),
            samplerate=self.sample_rate,
            channels=1,
            dtype='float32'
        )
        for s in range(int(duration_sec), 0, -1):
            print(f"   ⏳ {s}s remaining...", end="\r", flush=True)
            time.sleep(1)
        sd.wait()
        print("\n✅ Recording finished! Processing audio...")
        return audio_data.flatten()

    def transcribe(self, audio_data: np.ndarray) -> str:
        """Transcribe audio with Whisper auto language detection."""
        if not self.stt_model:
            return ""
        try:
            try:
                segments = self.stt_model.transcribe(audio_data, language='auto')
            except TypeError:
                segments = self.stt_model.transcribe(audio_data)

            raw_text = "".join(seg.text for seg in segments).strip()
            return raw_text
        except Exception as e:
            print(f"Transcription error: {e}")
            return ""

    def detect_names(self, text: str) -> list:
        """
        Detect contact and relation names from text using:
        1. ContactLanguageBridge normalization
        2. Known relation aliases (papa, pappa, mummy, bhaiya, didi, etc.)
        3. Ejected WhatsApp contacts and Roman Hindi dictionary
        """
        detected = []
        normalized_text = contact_bridge.normalize_speech_input(text) if contact_bridge else text
        tokens = re.findall(r'\b[A-Za-z\u0900-\u097F]+\b', normalized_text)
        tokens_lower = [t.lower() for t in tokens]

        # 1. Check Indic Relation Aliases
        for canonical, variants in RELATION_ALIASES.items():
            for v in variants:
                v_clean = v.lower()
                if v_clean in tokens_lower or v_clean in normalized_text.lower():
                    dev_repr = contact_bridge.get_devanagari(canonical) if contact_bridge else canonical
                    detected.append({
                        "name": canonical.capitalize(),
                        "alias_matched": v,
                        "devanagari": dev_repr,
                        "type": "Relation/Family"
                    })
                    break

        # 2. Check contacts from directory / WhatsApp bridge
        if contact_bridge:
            contacts = contact_bridge.eject_all_contacts()
            for c in contacts:
                c_name = c.get("name", "").strip()
                c_nick = c.get("nickname", "").strip()
                if not c_name:
                    continue

                if (c_name.lower() in normalized_text.lower() or 
                    (c_nick and c_nick.lower() in normalized_text.lower())):
                    dev_repr = c.get("devanagari") or contact_bridge.get_devanagari(c_name)
                    detected.append({
                        "name": c_name,
                        "alias_matched": c_name,
                        "devanagari": dev_repr,
                        "type": "Contact"
                    })

        # Deduplicate by name
        unique_detected = []
        seen = set()
        for d in detected:
            k = d["name"].lower()
            if k not in seen:
                seen.add(k)
                unique_detected.append(d)

        return unique_detected

    def speak(self, text: str, voice: str = "hf_alpha", speed: float = 1.0):
        """Speak text using Kokoro TTS hf_alpha voice and play via speakers."""
        if not self.tts_pipeline:
            print(f"⚠️ TTS pipeline not available to say: {text}")
            return

        print(f"\n🗣️ Kokoro TTS Speaking ('{voice}'): '{text}'")
        # Convert Roman Hindi / Hinglish to Devanagari representation for optimal Hindi pronunciation
        speech_text = self.normalizer.to_hindi_tts(text) if self.normalizer else text

        try:
            generator = self.tts_pipeline(
                speech_text,
                voice=voice,
                speed=speed,
                split_pattern=r'\n+'
            )
            all_audio = []
            for _, _, audio in generator:
                all_audio.append(np.asarray(audio, dtype=np.float32))

            if all_audio:
                audio_concat = np.concatenate(all_audio)
                # Play audio through speakers
                sd.play(audio_concat, samplerate=24000)
                sd.wait()
                # Save a copy for verification
                out_path = os.path.join(CURRENT_DIR, "test_output.wav")
                sf.write(out_path, audio_concat, 24000)
                print(f"✅ Audio played & saved to: {out_path}")
        except Exception as e:
            print(f"❌ Error during speech synthesis: {e}")

    def run_voice_cycle(self, duration_sec=5.0):
        """Full voice loop: Mic -> STT -> Detect Name -> Repeat with Kokoro TTS."""
        print("\n" + "=" * 60)
        print("🎙️ PIHU VOICE TEST: STT (Whisper Auto) ➡️ TTS (Kokoro hf_alpha)")
        print("=" * 60)

        # 1. Capture audio
        audio = self.record_microphone(duration_sec=duration_sec)

        # 2. STT Transcription
        raw_transcript = self.transcribe(audio)
        print(f"\n📝 Raw STT Transcript: \"{raw_transcript}\"")

        if not raw_transcript:
            print("⚠️ No speech detected.")
            self.speak("मुझे कोई आवाज़ सुनाई नहीं दी। कृपया फिर से बोलें।")
            return

        # 3. Normalization & Name Detection
        normalized = contact_bridge.normalize_speech_input(raw_transcript) if contact_bridge else raw_transcript
        print(f"✨ Normalized Transcript: \"{normalized}\"")

        detected_names = self.detect_names(raw_transcript)
        print(f"\n🔍 Detected Names / Contacts: {detected_names}")

        # 4. Repeat back using Kokoro TTS
        if detected_names:
            names_str = ", ".join([f"{d['devanagari']} ({d['name']})" for d in detected_names])
            first_name_dev = detected_names[0]['devanagari']
            tts_response = f"मैंने पहचाना {first_name_dev}। क्या आप {first_name_dev} को संदेश भेजना चाहते हैं?"
            print(f"\n🎯 Output Response: {tts_response}")
            self.speak(tts_response, voice="hf_alpha")
        else:
            # If no specific name matched, repeat what user said
            tts_response = f"आपने कहा: {normalized}"
            self.speak(tts_response, voice="hf_alpha")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PIHU Voice & Contact Detection Tester")
    parser.add_argument("--text", type=str, help="Simulate STT with text input (skips microphone)")
    parser.add_argument("--duration", type=float, default=5.0, help="Mic recording duration in seconds")
    args = parser.parse_args()

    tester = VoiceTester()

    if args.text:
        print(f"\n🧪 [Simulation Mode] Testing with input text: \"{args.text}\"")
        detected = tester.detect_names(args.text)
        print(f"🔍 Detected Names: {detected}")
        if detected:
            first_name_dev = detected[0]['devanagari']
            response = f"मैंने पहचाना {first_name_dev}।"
        else:
            norm = tester.normalizer.to_hindi_tts(args.text)
            response = f"आपने कहा: {norm}"
        tester.speak(response, voice="hf_alpha")
    else:
        tester.run_voice_cycle(duration_sec=args.duration)

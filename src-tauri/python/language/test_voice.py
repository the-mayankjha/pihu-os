"""
PIHU Language Module Voice Tester (src-tauri/python/language/test_voice.py)
-------------------------------------------------------------------------
1. Captures voice from microphone (or test text).
2. Runs Multilingual Whisper STT (models/stt/ggml-base.bin) supporting Hindi + English.
3. Cleans transcript & filters out sound hallucination tags (e.g. [music], (applause)).
4. Detects contact/relation names using exact word boundaries with ContactLanguageBridge.
5. Repeats the recognized contact name using Kokoro TTS ('hf_alpha' Hindi female voice).

Usage:
    # Run live microphone test:
    python test_voice.py --duration 5.0

    # Run simulation / text test:
    python test_voice.py --text "message papa that I am coming"
"""

import os
import sys
import re
import io
import time
import argparse
import numpy as np
import soundfile as sf

# Resolve paths
LANG_DIR = os.path.dirname(os.path.abspath(__file__))
PYTHON_DIR = os.path.dirname(LANG_DIR)
PROJECT_ROOT = os.path.dirname(os.path.dirname(PYTHON_DIR))

if PYTHON_DIR not in sys.path:
    sys.path.insert(0, PYTHON_DIR)
if LANG_DIR not in sys.path:
    sys.path.insert(0, LANG_DIR)

# Import Language module & Bridge
try:
    from contact_bridge import bridge as contact_bridge, RELATION_ALIASES
    from speech.normalizer import SpeechNormalizer
except ImportError:
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
        """Initialize Whisper STT model with multilingual base model."""
        print("\n[2/2] 🎙️ Initializing Whisper STT (Multilingual Hindi/English)...")
        if WhisperModel is None:
            print("⚠️ pywhispercpp not installed.")
            return

        models_dir = os.path.join(PROJECT_ROOT, 'models', 'stt')
        os.makedirs(models_dir, exist_ok=True)

        # Prioritize high-accuracy multilingual ggml-small.bin
        candidate_files = [
            os.path.join(models_dir, 'ggml-small.bin'),
            os.path.join(models_dir, 'ggml-base.bin'),
            os.path.join(models_dir, 'ggml-base.en.bin'),
        ]

        for path in candidate_files:
            if os.path.exists(path):
                try:
                    print(f"Loading local Whisper model from {path}...")
                    self.stt_model = WhisperModel(path)
                    print(f"✅ Whisper STT Model loaded: {os.path.basename(path)}")
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

    def clean_transcript(self, text: str) -> str:
        """Strip audio hallucinations, parenthesized/bracketed sounds, and non-speech symbols."""
        if not text:
            return ""
        # Remove parenthesized sounds: (dramatic music), (cheers), (screaming), etc.
        clean = re.sub(r'\([^\)]*\)', '', text)
        # Remove bracketed tags: [music], [laughter], [applause], [silence]
        clean = re.sub(r'\[[^\]]*\]', '', clean)
        # Remove repeated music/sound keywords
        clean = re.sub(r'\b(?:dramatic\s+music|music|applause|laughter|silence|inaudible)\b', '', clean, flags=re.IGNORECASE)
        # Collapse multiple spaces and trim
        clean = re.sub(r'\s+', ' ', clean).strip()
        # Remove leading/trailing non-alphanumeric chars
        clean = re.sub(r'^[^\w\u0900-\u097F]+|[^\w\u0900-\u097F]+$', '', clean).strip()
        return clean

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
        """Transcribe audio with Whisper multilingual model."""
        if not self.stt_model:
            return ""
        try:
            # Transcribe without invalid 'auto' string argument
            segments = self.stt_model.transcribe(audio_data)
            raw_text = "".join(seg.text for seg in segments).strip()
            return raw_text
        except Exception as e:
            print(f"Transcription error: {e}")
            return ""

    def detect_names(self, raw_text: str) -> list:
        """
        Detect contact and relation names from text using exact word boundaries:
        1. Indic relation aliases (papa, pappa, mummy, bhaiya, didi, etc.)
        2. Cleaned contacts from directory / WhatsApp bridge
        """
        detected = []
        cleaned_text = self.clean_transcript(raw_text)
        if not cleaned_text:
            return []

        normalized_text = contact_bridge.normalize_speech_input(cleaned_text) if contact_bridge else cleaned_text
        
        # 1. Check Indic Relation Aliases with whole word boundary
        for canonical, variants in RELATION_ALIASES.items():
            for v in variants:
                v_clean = v.strip()
                if not v_clean or len(v_clean) < 2:
                    continue
                # Match full word boundary
                pattern = rf'\b{re.escape(v_clean)}\b'
                if (re.search(pattern, normalized_text, re.IGNORECASE) or 
                    re.search(pattern, cleaned_text, re.IGNORECASE)):
                    dev_repr = contact_bridge.get_devanagari(canonical) if contact_bridge else canonical
                    detected.append({
                        "name": canonical.capitalize(),
                        "alias_matched": v_clean,
                        "devanagari": dev_repr,
                        "type": "Relation/Family"
                    })
                    break

        # 2. Check contacts from directory / WhatsApp bridge with whole word boundary
        if contact_bridge:
            contacts = contact_bridge.eject_all_contacts()
            for c in contacts:
                c_name = c.get("name", "").strip()
                c_nick = c.get("nickname", "").strip()
                
                # Filter out single characters, punctuation, numbers, or meaningless tags
                if not c_name or len(c_name) < 3 or not re.search(r'[A-Za-z\u0900-\u097F]{3,}', c_name):
                    continue

                name_pattern = rf'\b{re.escape(c_name)}\b'
                nick_pattern = rf'\b{re.escape(c_nick)}\b' if c_nick and len(c_nick) >= 3 else None

                name_matched = bool(re.search(name_pattern, normalized_text, re.IGNORECASE) or 
                                    re.search(name_pattern, cleaned_text, re.IGNORECASE))
                nick_matched = bool(nick_pattern and (re.search(nick_pattern, normalized_text, re.IGNORECASE) or 
                                                     re.search(nick_pattern, cleaned_text, re.IGNORECASE)))

                if name_matched or nick_matched:
                    dev_repr = c.get("devanagari") or contact_bridge.get_devanagari(c_name)
                    detected.append({
                        "name": c_name,
                        "alias_matched": c_nick if nick_matched else c_name,
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

    def speak(self, text: str, voice: str = "af_bella", speed: float = 1.0):
        """Speak complete text naturally without awkward pauses or chopped segments."""
        if not self.tts_pipeline:
            print(f"⚠️ TTS pipeline not available to say: {text}")
            return

        has_devanagari = bool(re.search(r'[\u0900-\u097F]', text))
        chosen_voice = 'hf_alpha' if has_devanagari else 'af_bella'
        print(f"\n🗣️ Kokoro TTS Speaking ('{chosen_voice}'): '{text}'")

        try:
            generator = self.tts_pipeline(
                text,
                voice=chosen_voice,
                speed=speed,
                split_pattern=r'\n+'
            )
            all_audio = []
            for _, _, audio in generator:
                all_audio.append(np.asarray(audio, dtype=np.float32))

            if all_audio:
                audio_concat = np.concatenate(all_audio)
                sd.play(audio_concat, samplerate=24000)
                sd.wait()
                out_path = os.path.join(LANG_DIR, "test_output.wav")
                sf.write(out_path, audio_concat, 24000)
                print(f"✅ Audio played & saved to: {out_path}")
        except Exception as e:
            print(f"❌ Error during speech synthesis: {e}")

    def run_voice_cycle(self, duration_sec=5.0):
        """Full voice loop: Mic -> STT -> Detect Name -> Repeat with Kokoro TTS."""
        print("\n" + "=" * 60)
        print("🎙️ PIHU VOICE TEST: STT (Whisper Multilingual) ➡️ TTS (Kokoro hf_alpha)")
        print("=" * 60)

        # 1. Capture audio
        audio = self.record_microphone(duration_sec=duration_sec)

        # 2. STT Transcription
        raw_transcript = self.transcribe(audio)
        print(f"\n📝 Raw STT Transcript: \"{raw_transcript}\"")

        clean_text = self.clean_transcript(raw_transcript)
        if not clean_text:
            print("⚠️ No valid speech detected.")
            self.speak("मुझे कोई आवाज़ सुनाई नहीं दी। कृपया फिर से बोलें।")
            return

        # 3. Normalization & Name Detection
        normalized = contact_bridge.normalize_speech_input(clean_text) if contact_bridge else clean_text
        print(f"✨ Normalized Transcript: \"{normalized}\"")

        detected_names = self.detect_names(clean_text)
        print(f"\n🔍 Detected Names / Contacts: {detected_names}")

        # 4. Repeat back using Kokoro TTS
        if detected_names:
            first_name_dev = detected_names[0]['devanagari']
            tts_response = f"मैंने पहचाना {first_name_dev}। क्या आप {first_name_dev} को संदेश भेजना चाहते हैं?"
            print(f"\n🎯 Output Response: {tts_response}")
            self.speak(tts_response, voice="hf_alpha")
        else:
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

import os
import sys
import io
import re
import time
import threading
import numpy as np
import soundfile as sf
from flask import Flask, request, send_file
from flask_cors import CORS
from kokoro import KPipeline

current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

try:
    from language.speech.normalizer import SpeechNormalizer
    normalizer = SpeechNormalizer()
except Exception as e:
    normalizer = None
    print(f"[TTS Server] Warning: Could not load SpeechNormalizer: {e}", flush=True)

app = Flask(__name__)
CORS(app)

pipeline_hi = None  # Kokoro Hindi  (lang_code='h') -> voice hf_alpha (Native Indian Hindi / Hinglish)
pipeline_en = None  # Kokoro English (lang_code='a') -> voice af_bella (Fluent English)

SAMPLE_RATE = 24000

def init_pipelines():
    global pipeline_hi, pipeline_en
    try:
        print("[TTS Server] Initializing Kokoro Dual Pipelines...", flush=True)
        try:
            pipeline_hi = KPipeline(lang_code='h')
            print("[TTS Server] ✅ Kokoro Hindi Pipeline (hf_alpha) Ready!", flush=True)
        except Exception as eh:
            print(f"[TTS Server] ⚠️ Kokoro Hindi unavailable: {eh}", flush=True)

        try:
            pipeline_en = KPipeline(lang_code='a')
            print("[TTS Server] ✅ Kokoro English Pipeline (af_bella) Ready!", flush=True)
        except Exception as ea:
            print(f"[TTS Server] ⚠️ Kokoro English unavailable: {ea}", flush=True)
    except Exception as e:
        print(f"[TTS Server] Failed to initialize pipelines: {e}", flush=True)


def is_hindi_or_hinglish(text: str) -> bool:
    """Detect if text is Hindi or Romanized Hinglish."""
    # 1. Contains Devanagari Unicode
    if re.search(r'[\u0900-\u097F]', text):
        return True

    # 2. Contains common Hindi/Hinglish vocabulary tokens
    hindi_keywords = {
        'papa', 'pappa', 'paapa', 'pitaji', 'mummy', 'mumma', 'maa', 'mataji',
        'bhai', 'bhaiya', 'didi', 'behen', 'chacha', 'chachu', 'mama', 'dada', 'dadi',
        'nana', 'nani', 'bhabhi', 'jiju', 'haan', 'han', 'nahi', 'nhi', 'acha',
        'achha', 'theek', 'thik', 'karo', 'karna', 'karti', 'karta', 'karunga', 'karungi',
        'karenge', 'karengi', 'kholo', 'chalao', 'chala', 'chalo', 'badhao', 'rok', 'roko',
        'batao', 'bataiye', 'bol', 'sun', 'sunao', 'pihu', 'main', 'mai', 'maine', 'mera',
        'meri', 'mere', 'tum', 'aap', 'ap', 'aapka', 'aapki', 'aapke', 'tera', 'teri', 'tere',
        'hum', 'ham', 'yeh', 'ye', 'woh', 'vo', 'abhi', 'badme', 'kya', 'kyun', 'kaise',
        'kaha', 'kidhar', 'kaun', 'hai', 'hain', 'ho', 'hoon', 'hu', 'tha', 'thi', 'the',
        'diya', 'diye', 'gaya', 'gayi', 'bhejo', 'bhej', 'bhejna', 'bhejti', 'bhejta',
        'badhiya', 'shukriya', 'dost', 'yaar', 'yar', 'lekin', 'magar', 'koi', 'kuch', 'sab',
        'samajh', 'matlab', 'aaya', 'aayi', 'aaye', 'chahte', 'chahti', 'namaste', 'zaroor',
        'bilkul', 'taiyaar', 'tayaar', 'kripya', 'dhanyawad', 'dhanyavad'
    }
    tokens = {w.lower() for w in re.findall(r'\b[A-Za-z]+\b', text)}
    return bool(tokens.intersection(hindi_keywords))


def clean_for_tts(text: str) -> str:
    """Strip markdown formatting, sound hallucination tags, and special characters."""
    if not text:
        return ""
    text = re.sub(r'\*\*', '', text)
    text = re.sub(r'\*', '', text)
    text = re.sub(r'#', '', text)
    text = re.sub(r'`', '', text)
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    text = re.sub(r'>', '', text)
    text = re.sub(r'---', '', text)
    text = re.sub(r'\([^\)]*(?:music|cheers|applause|laughter)[^\)]*\)', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\[[^\]]*\]', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def synthesize_speech(text: str, requested_voice: str = 'auto', speed: float = 1.0) -> np.ndarray | None:
    """
    Intelligent Hindi, English & Hinglish Speech Synthesis:
    1. If text is Hindi or Hinglish (e.g. 'Maine check kiya lekin WhatsApp par Papa nahi mila'):
       - Converts Roman Hindi tokens to authentic Devanagari using SpeechNormalizer.
       - Synthesizes using Kokoro Hindi pipeline (hf_alpha) for native Indian voice.
    2. If text is pure English (e.g. 'Opening Google Chrome for you right now'):
       - Synthesizes directly using Kokoro English pipeline (af_bella).
    """
    cleaned = clean_for_tts(text)
    if not cleaned:
        return None

    is_indic = is_hindi_or_hinglish(cleaned) or requested_voice.startswith('hf_') or requested_voice.startswith('hm_')

    if is_indic and pipeline_hi is not None:
        speech_text = normalizer.to_hindi_segment(cleaned) if normalizer else cleaned
        target_pipeline = pipeline_hi
        actual_voice = requested_voice if (requested_voice.startswith('hf_') or requested_voice.startswith('hm_')) else 'hf_alpha'
        lang_label = 'Hindi (hf_alpha)'
    else:
        speech_text = cleaned
        target_pipeline = pipeline_en or pipeline_hi
        actual_voice = requested_voice if (requested_voice.startswith('af_') or requested_voice.startswith('am_') or requested_voice.startswith('bf_') or requested_voice.startswith('bm_')) else 'af_bella'
        lang_label = 'English (af_bella)'

    print(f"[TTS Server] 🗣️ Synthesizing [{lang_label}]: '{speech_text[:75]}...'", flush=True)

    try:
        generator = target_pipeline(speech_text, voice=actual_voice, speed=speed, split_pattern=r'\n+')
        audio_chunks = [np.asarray(audio, dtype=np.float32) for _, _, audio in generator]
        if audio_chunks:
            return np.concatenate(audio_chunks)
    except Exception as e:
        print(f"[TTS Server] Primary synthesis error ({actual_voice}): {e}", flush=True)
        fallback = pipeline_en if target_pipeline == pipeline_hi else pipeline_hi
        if fallback:
            try:
                fb_voice = 'af_bella' if fallback == pipeline_en else 'hf_alpha'
                print(f"[TTS Server] Retrying with fallback voice '{fb_voice}'...", flush=True)
                generator = fallback(cleaned, voice=fb_voice, speed=speed, split_pattern=r'\n+')
                audio_chunks = [np.asarray(audio, dtype=np.float32) for _, _, audio in generator]
                if audio_chunks:
                    return np.concatenate(audio_chunks)
            except Exception as e2:
                print(f"[TTS Server] Fallback error: {e2}", flush=True)

    return None


@app.route('/health', methods=['GET'])
def health():
    ready = bool(pipeline_hi or pipeline_en)
    if ready:
        return {
            "status": "ready",
            "hindi_ready": pipeline_hi is not None,
            "english_ready": pipeline_en is not None
        }, 200
    return {"status": "initializing"}, 503


@app.route('/generate', methods=['GET', 'POST'])
def generate():
    for _ in range(240):
        if pipeline_hi or pipeline_en:
            break
        time.sleep(0.5)

    if not pipeline_hi and not pipeline_en:
        return "Pipelines failed to initialize.", 503

    if request.method == 'POST':
        data = request.json or {}
        text = data.get('text', '')
        voice = data.get('voice', 'auto')
        speed = float(data.get('speed', 1.0))
    else:
        text = request.args.get('text', '')
        voice = request.args.get('voice', 'auto')
        speed = float(request.args.get('speed', 1.0))

    if not text or not text.strip():
        return "No text provided", 400

    audio_data = synthesize_speech(text, requested_voice=voice, speed=speed)

    if audio_data is None or len(audio_data) == 0:
        return "Failed to generate audio", 500

    wav_io = io.BytesIO()
    sf.write(wav_io, audio_data, SAMPLE_RATE, format='WAV', subtype='PCM_16')
    wav_io.seek(0)

    return send_file(
        wav_io,
        mimetype="audio/wav",
        as_attachment=False,
        download_name="tts.wav"
    )


if __name__ == '__main__':
    threading.Thread(target=init_pipelines, daemon=True).start()
    print("TTS Server starting on port 48126 (Hindi + English + Hinglish Auto)", flush=True)
    app.run(host='127.0.0.1', port=48126, threaded=True)

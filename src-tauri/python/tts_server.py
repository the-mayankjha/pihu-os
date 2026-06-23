from flask import Flask, request, send_file
from flask_cors import CORS
from kokoro import KPipeline
import soundfile as sf
import io
import threading
import sys
import numpy as np

app = Flask(__name__)
CORS(app)

pipeline = None

def init_pipeline():
    global pipeline
    try:
        print("[TTS Server] Initializing Kokoro Pipeline...", flush=True)
        pipeline = KPipeline(lang_code='a')
        print("[TTS Server] Kokoro Pipeline Ready!", flush=True)
    except Exception as e:
        print(f"[TTS Server] Failed to initialize pipeline: {e}", flush=True)

@app.route('/generate', methods=['GET', 'POST'])
def generate():
    global pipeline
    
    # Wait up to 120 seconds for the pipeline to initialize (downloads can take time)
    import time
    for _ in range(240):
        if pipeline:
            break
        time.sleep(0.5)

    if not pipeline:
        return "Pipeline failed to initialize or is taking too long.", 503

    if request.method == 'POST':
        data = request.json
        text = data.get('text', '')
        voice = data.get('voice', 'af_bella')
        speed = float(data.get('speed', 1.0))
    else:
        text = request.args.get('text', '')
        voice = request.args.get('voice', 'af_bella')
        speed = float(request.args.get('speed', 1.0))

    if not text:
        return "No text provided", 400

    print(f"[TTS Server] Generating audio for: '{text[:50]}...' using voice: {voice}", flush=True)

    try:
        generator = pipeline(
            text, voice=voice, 
            speed=speed, split_pattern=r'\n+'
        )

        all_audio = []
        sample_rate = 24000
        for i, (gs, ps, audio) in enumerate(generator):
            all_audio.append(audio)
            
        if not all_audio:
            return "Failed to generate audio", 500

        audio_concat = np.concatenate(all_audio)
        wav_io = io.BytesIO()
        sf.write(wav_io, audio_concat, sample_rate, format='WAV', subtype='PCM_16')
        wav_io.seek(0)

        return send_file(
            wav_io,
            mimetype="audio/wav",
            as_attachment=False,
            download_name="tts.wav"
        )
    except Exception as e:
        print(f"[TTS Server] Error: {e}", flush=True)
        return str(e), 500

if __name__ == '__main__':
    threading.Thread(target=init_pipeline, daemon=True).start()
    
    print("TTS Server starting on port 48126", flush=True)
    app.run(host='127.0.0.1', port=48126, threaded=True)

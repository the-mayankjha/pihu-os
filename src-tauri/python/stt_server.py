import asyncio
import websockets
import json
import logging
import os
import sys
import re
import threading
import numpy as np
from pywhispercpp.model import Model

# Add language module to path
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

try:
    from language.contact_bridge import bridge as contact_bridge
except ImportError:
    contact_bridge = None

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('stt_server')

def check_stdin():
    while True:
        line = sys.stdin.readline()
        if not line:
            logger.info("stdin closed. Parent died. Exiting.")
            os._exit(0)

threading.Thread(target=check_stdin, daemon=True).start()

# Global model instance
model = None

# Initial Prompt: Conditions Whisper's decoder specifically on Hindi/Hinglish vocabulary and Indic relations
HINDI_ENGLISH_INITIAL_PROMPT = (
    "नमस्ते PIHU, पापा, पप्पा, मम्मी, भैया, दीदी, चाचा, मामा, दादा, दादी, "
    "कांटेक्ट, मैसेज, व्हाट्सएप, क्रोम, स्पॉटिफ़ाई, सेटिंग्स, खोलो, चलाओ, भेजो, "
    "Papa, Pappa, Mummy, Bhaiya, Didi, Chrome, WhatsApp, message, send, open, Spotify, Hinglish."
)

def init_model():
    global model
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    models_dir = os.path.join(project_root, 'models', 'stt')
    os.makedirs(models_dir, exist_ok=True)

    # 1. Search for high-accuracy multilingual 'small' model first (244M params, high accuracy for Hindi), then 'base', then 'base.en'
    candidate_files = [
        os.path.join(models_dir, 'ggml-small.bin'),
        os.path.join(models_dir, 'ggml-base.bin'),
        os.path.join(models_dir, 'ggml-base.en.bin'),
    ]

    for c in candidate_files:
        if os.path.exists(c):
            try:
                logger.info(f"Loading local Whisper model from {c} (High Accuracy Hindi + English)...")
                model = Model(c)
                logger.info(f"Successfully loaded STT model: {os.path.basename(c)}")
                return True
            except Exception as e:
                logger.warning(f"Could not load {c}: {e}")

    # 2. Try loading multilingual 'small' / 'base' model via pywhispercpp auto-download
    for fallback_name in ['small', 'base', 'base.en']:
        try:
            logger.info(f"Attempting to load '{fallback_name}' model via pywhispercpp...")
            model = Model(fallback_name, models_dir=models_dir)
            logger.info(f"Successfully loaded '{fallback_name}' STT model!")
            return True
        except Exception as e:
            logger.warning(f"Could not load '{fallback_name}' model directly: {e}")

    return False


def clean_stt_transcript(text: str) -> str:
    """
    Clean STT transcript and ensure it contains ONLY Hindi (Devanagari) and English (Latin).
    Strips hallucination sound tags like (music), [applause], etc.
    """
    if not text:
        return ""
    # Strip parenthesized or bracketed sounds
    clean = re.sub(r'\([^\)]*\)', '', text)
    clean = re.sub(r'\[[^\]]*\]', '', clean)
    clean = re.sub(r'\b(?:dramatic\s+music|music|applause|laughter|silence|cheering|screaming)\b', '', clean, flags=re.IGNORECASE)
    
    # Filter to only allow Latin letters, Devanagari script, digits, spaces, and basic punctuation
    clean = re.sub(r'[^\w\s\u0900-\u097F.,!?\'"-]', '', clean)
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean


def transcribe_audio(audio_data: np.ndarray) -> str:
    """
    Transcribe audio with pywhispercpp conditioned on Hindi + English prompt:
    1. Uses HINDI_ENGLISH_INITIAL_PROMPT to bias recognition toward Indic terms (Papa, Mummy, etc.).
    2. Filters out foreign script hallucinations (Arabic/Urdu/Cyrillic).
    3. Normalizes through Contact & Language Bridge.
    """
    if not model or len(audio_data) == 0:
        return ""

    try:
        # Transcribe with Hindi/Hinglish initial prompt conditioning
        try:
            segments = model.transcribe(
                audio_data,
                initial_prompt=HINDI_ENGLISH_INITIAL_PROMPT,
                suppress_non_speech_tokens=True
            )
        except Exception as ep:
            logger.warning(f"Transcribe with prompt fallback ({ep}), running standard...")
            segments = model.transcribe(audio_data)

        raw_text = "".join(seg.text for seg in segments).strip()
        logger.info(f"Raw Whisper transcription: '{raw_text}'")

        # Check if raw text contains foreign non-Hindi/non-English scripts
        has_foreign = bool(re.search(r'[\u0600-\u06FF\u0750-\u077F\u0400-\u04FF]', raw_text))
        if has_foreign:
            logger.warning("Detected foreign script hallucination. Retrying transcription with language='en'...")
            segments = model.transcribe(audio_data, language='en')
            raw_text = "".join(seg.text for seg in segments).strip()
            logger.info(f"Fallback English transcription: '{raw_text}'")

        cleaned = clean_stt_transcript(raw_text)
        return cleaned

    except Exception as e:
        logger.error(f"Error during transcription: {e}")
        return ""


async def handle_client(websocket):
    logger.info("Client connected to STT server")
    
    # Audio accumulator for the current session
    audio_accumulator = []
    
    try:
        async for message in websocket:
            if isinstance(message, bytes):
                # 16kHz f32le PCM data from the microphone
                audio_data = np.frombuffer(message, dtype=np.float32)
                audio_accumulator.append(audio_data)
                
            else:
                data = json.loads(message)
                logger.info(f"Received JSON message: {data}")
                
                if data.get("type") == "reset":
                    audio_accumulator.clear()
                elif data.get("type") == "process":
                    if model and len(audio_accumulator) > 0:
                        logger.info("Processing accumulated audio...")
                        full_audio = np.concatenate(audio_accumulator)
                        
                        raw_text = transcribe_audio(full_audio)
                        
                        # Apply Contact & Language Bridge Normalization
                        if raw_text and contact_bridge:
                            normalized_text = contact_bridge.normalize_speech_input(raw_text)
                            logger.info(f"Normalized transcription: '{normalized_text}'")
                            final_text = normalized_text
                        else:
                            final_text = raw_text

                        if final_text and final_text.strip():
                            await websocket.send(json.dumps({
                                "type": "transcription",
                                "text": final_text,
                                "raw_text": raw_text
                            }))
                        else:
                            await websocket.send(json.dumps({
                                "type": "transcription",
                                "text": "[BLANK_AUDIO]"
                            }))
                    else:
                        await websocket.send(json.dumps({
                            "type": "transcription",
                            "text": "[BLANK_AUDIO]"
                        }))
                    
                    # Clear accumulator for next sentence
                    audio_accumulator = []
                
    except websockets.exceptions.ConnectionClosed:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"Error handling client: {e}")
        try:
            await websocket.send(json.dumps({
                "type": "error",
                "message": str(e)
            }))
        except:
            pass


async def main():
    if not init_model():
        logger.error("Could not initialize STT model. Server not starting.")
        return
        
    server = await websockets.serve(handle_client, "127.0.0.1", 5001)
    logger.info("STT Server started on ws://127.0.0.1:5001 (High Accuracy Hindi + English Whisper Small)")
    await server.wait_closed()


if __name__ == "__main__":
    asyncio.run(main())

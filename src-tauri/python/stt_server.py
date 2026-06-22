import asyncio
import websockets
import json
import logging
from pywhispercpp.model import Model
import numpy as np
import os

import sys
import threading

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('stt_server')

def check_stdin():
    while True:
        line = sys.stdin.readline()
        if not line:
            logger.info("stdin closed. Parent died. Exiting.")
            os._exit(0)

threading.Thread(target=check_stdin, daemon=True).start()

# Path to the ggml-base.en.bin model
MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'models', 'stt', 'ggml-base.en.bin')

# Global model instance
model = None

def init_model():
    global model
    if not os.path.exists(MODEL_PATH):
        logger.error(f"Model not found at {MODEL_PATH}. Please run the download script.")
        return False
        
    try:
        # Load whispercpp model
        model = Model(MODEL_PATH)
        logger.info(f"Successfully loaded STT model: {MODEL_PATH}")
        return True
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        return False

async def handle_client(websocket):
    logger.info("Client connected to STT server")
    
    # Audio accumulator for the current session
    audio_accumulator = []
    
    try:
        async for message in websocket:
            if isinstance(message, bytes):
                # We expect raw 16kHz f32le PCM data from the browser
                # Accumulate the bytes instead of processing immediately
                audio_data = np.frombuffer(message, dtype=np.float32)
                audio_accumulator.append(audio_data)
                
            else:
                data = json.loads(message)
                logger.info(f"Received JSON message: {data}")
                
                if data.get("type") == "process":
                    if model and len(audio_accumulator) > 0:
                        logger.info("Processing accumulated audio...")
                        # Concatenate all chunks
                        full_audio = np.concatenate(audio_accumulator)
                        
                        # Transcribe the full accumulated audio
                        segments = model.transcribe(full_audio)
                        
                        text = ""
                        for segment in segments:
                            text += segment.text

                        text = text.strip()
                        logger.info(f"Transcription result: {text}")
                        
                        if text:
                            await websocket.send(json.dumps({
                                "type": "transcription",
                                "text": text
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
    logger.info("STT Server started on ws://127.0.0.1:5001")
    await server.wait_closed()

if __name__ == "__main__":
    asyncio.run(main())

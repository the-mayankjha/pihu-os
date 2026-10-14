import os
from pathlib import Path
from sarvamai import SarvamAI

# Load .env into os.environ if present
env_candidates = [
    Path(__file__).resolve().parent / ".env",
    Path(__file__).resolve().parent.parent / ".env"
]
env_path = next((p for p in env_candidates if p.exists()), None)
if env_path:
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            stripped = line.strip()
            if stripped and not stripped.startswith("#") and "=" in stripped:
                k, v = stripped.split("=", 1)
                k = k.strip()
                v = v.strip().strip("'\"")
                if k not in os.environ and v:
                    os.environ[k] = v

api_key = os.environ.get("SARVAM_API_KEY")
if not api_key:
    raise RuntimeError("SARVAM_API_KEY is not set in environment or .env file.")

client = SarvamAI(api_subscription_key=api_key)

# 1. Chat Completion with sarvam-105b-conversations
chat_response = client.chat.completions(
    model="sarvam-105b-conversations",
    messages=[
        {"role": "user", "content": "नमस्ते! अपना संक्षिप्त परिचय एक वाक्य में दें।"}
    ],
)
reply = chat_response.choices[0].message.content
print("Chat Reply:", reply)

# 2. Text-to-Speech using aarti_hi_customer with target_language_code / language_code = "hi-IN"
tts_response = client.text_to_speech.convert(
    text=reply,
    language_code="hi-IN",
    speaker="aarti_hi_customer",
    model="bulbul:v4-flash",
)
print(f"TTS Success: Audio generated with speaker 'aarti_hi_customer' ({len(tts_response.audios)} audio clip(s) received).")

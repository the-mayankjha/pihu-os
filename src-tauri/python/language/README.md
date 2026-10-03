# PIHU Hinglish Speech Adapter

Keeps the UI response in Roman Hinglish while creating separate speech segments:
- `hi`: known Roman-Hindi words converted to Devanagari and sent to Kokoro Hindi (`lang_code="h"`)
- `en`: English terms preserved and sent to Kokoro American English (`lang_code="a"`)

## Files
- `roman_hindi.json`: editable Roman Hindi -> Devanagari vocabulary
- `phrases.json`: phrase-level mappings (checked before individual words)
- `english_terms.json`: English words/terms to preserve
- `speech/normalizer.py`: segmenter + normalizer
- `speech/kokoro_adapter.py`: Kokoro synthesis and direct playback

## Install
Activate your existing environment, then:
```bash
pip install kokoro sounddevice numpy
brew install espeak-ng
```

## Test normalization first
```bash
python test_normalizer.py
```

Review the output. This is intentionally a conservative dictionary-based normalizer, not a general-purpose Hindi transliteration model. Unknown Roman-Hindi words remain in English rather than being guessed. Add your own vocabulary to `roman_hindi.json` and common expressions to `phrases.json`.

## Play a response
From the project root, adapt the import path as needed:
```python
from pihu_speech.speech.kokoro_adapter import KokoroSpeech

speaker = KokoroSpeech(hindi_voice="hf_alpha", english_voice="af_heart")
speaker.speak("Haan, kr deti hoon. Let me check.")
```

If your installed Kokoro package/checkpoint does not include the Hindi pipeline or the selected voice, verify the exact model package/version and available voice IDs. Audio sample rate is configured as 24 kHz here; confirm it matches your installed pipeline.

## PIHU integration
Keep `display_text` unchanged. Pass the same response separately to `speaker.speak(display_text)`. The adapter normalizes only the speech copy.

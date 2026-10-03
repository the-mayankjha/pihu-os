from speech.normalizer import SpeechNormalizer

normalizer = SpeechNormalizer()

text = "Hello Mayank, kya haal hai? PIHU is working on your setup."

print("Original:", text)
print("Hindi TTS:", normalizer.to_hindi_tts(text))
print("Segments:", normalizer.to_debug_text(text))

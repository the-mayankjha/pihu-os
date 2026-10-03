import numpy as np
import sounddevice as sd
from kokoro import KPipeline

from .normalizer import SpeechNormalizer


class KokoroSpeech:

    def __init__(
        self,
        hindi_voice="hf_alpha",
        speed=1.0,
        sample_rate=24000,
    ):
        self.normalizer = SpeechNormalizer()

        # ONE pipeline, ONE voice
        self.pipeline = KPipeline(lang_code="h")

        self.voice = hindi_voice
        self.speed = speed
        self.sample_rate = sample_rate

    def speak(self, text):

        # Convert the entire sentence into one Hindi-script
        # speech representation.
        speech_text = self.normalizer.to_hindi_tts(text)

        print(f"\nOriginal : {text}")
        print(f"Speech   : {speech_text}")

        chunks = []

        # Generate speech through a single Hindi pipeline.
        for _, _, audio in self.pipeline(
            speech_text,
            voice=self.voice,
            speed=self.speed,
        ):
            chunks.append(np.asarray(audio, dtype=np.float32))

        if not chunks:
            return

        # Combine chunks from the SAME generated utterance.
        audio = np.concatenate(chunks)

        # Play continuously.
        sd.play(audio, samplerate=self.sample_rate)
        sd.wait()

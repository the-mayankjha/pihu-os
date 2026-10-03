from pathlib import Path
import sys

# Run from this folder: python test_normalizer.py
from speech.normalizer import SpeechNormalizer

normalizer = SpeechNormalizer(Path(__file__).parent)

samples = [
    "Haan, kr deti hoon. Let me check.",
    "Acha, smjh gayi. Main abhi batati hoon.",
    "Kya scene hai bro? Pta nhi.",
    "PIHU, ek baar API check kar do.",
    "Thik hai, main computer setup kar deti hoon.",
]

for sample in samples:
    print("\nINPUT :", sample)
    print("OUTPUT:", normalizer.to_debug_text(sample))


from speech.kokoro_adapter import KokoroSpeech
from speech.normalizer import SpeechNormalizer


# ==========================================
# PIHU - Female Hindi Voice Test
# ==========================================

pihu = KokoroSpeech(
    hindi_voice="hf_alpha",
    speed=1.0,
)

normalizer = SpeechNormalizer()


TESTS = {
    "Hindi": [
        "नमस्ते! मैं PIHU हूँ।",
        "हाँ, बिल्कुल। मैं आपकी मदद कर सकती हूँ।",
        "अच्छा, समझ गई। मैं अभी यह काम कर देती हूँ।",
    ],

    "Hinglish": [
        "Haan, kr deti hoon.",
        "Acha, smjh gayi. Main abhi batati hoon.",
        "Thik hai, ek baar check krti hoon.",
        "Kya scene hai bro? Pta nhi.",
    ],

    "Mixed English + Hindi": [
        "Hey! Main PIHU hoon. How can I help you?",
        "Okay, let me check. Main abhi batati hoon.",
        "Haan, your API is working perfectly.",
    ],

    "Names and Technical Terms": [
        "Hello Mayank Kumar Jha!",
        "Mayank, tumhara PIHU setup ready hai.",
        "Your API is working perfectly.",
        "Gemini model successfully initialize ho gaya.",
        "Main tumhare laptop ko control kar sakti hoon.",
    ],
}


def speak_sentence(sentence: str):
    """Print original and normalized text, then play speech."""

    speech_text = normalizer.to_hindi_tts(sentence)

    print("\n--------------------------------")
    print(f"Original : {sentence}")
    print(f"Speech   : {speech_text}")
    print("--------------------------------")

    input("Press ENTER to speak...")

    try:
        pihu.speak(sentence)
    except Exception as error:
        print(f"\nTTS Error: {error}")


def test_category(category: str):
    print(f"\n========== {category} ==========")

    for sentence in TESTS[category]:
        speak_sentence(sentence)


def main():
    options = list(TESTS.keys())

    while True:
        print("\n================================")
        print("         PIHU VOICE TEST")
        print("         Voice: hf_alpha")
        print("         Language: Hindi")
        print("================================")

        for i, option in enumerate(options, 1):
            print(f"{i}. {option}")

        print(f"{len(options) + 1}. Test everything")
        print("0. Exit")

        choice = input("\nChoice: ").strip()

        if choice == "0":
            break

        elif choice == str(len(options) + 1):
            for category in options:
                test_category(category)

        elif choice.isdigit() and 1 <= int(choice) <= len(options):
            test_category(options[int(choice) - 1])

        else:
            print("Invalid choice!")

    print("\nPIHU voice test completed!")


if __name__ == "__main__":
    main()

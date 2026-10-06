from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Literal

SegmentLanguage = Literal["hi", "en"]


class SpeechNormalizer:
    """Convert Roman Hindi/Hinglish into speech-friendly segments."""

    TOKEN_RE = re.compile(
        r"[A-Za-z]+(?:'[A-Za-z]+)?|[\u0900-\u097F]+|[0-9]+|[^\w\s]",
        re.UNICODE,
    )

    # English words with Hindi-friendly pronunciation.
    ENGLISH_PHONETICS = {
        "okay": "ओके",
        "ok": "ओके",
        "sure": "श्योर",
        "yes": "येस",
        "no": "नो",
        "hello": "हेलो",
        "hey": "हे",
        "check": "चेक",
        "let": "लेट",
        "me": "मी",
        "please": "प्लीज़",
        "done": "डन",
        "working": "वर्किंग",
        "bro": "ब्रो",
        "api": "एपीआई",
        "pihu": "पीहू",
        "gemini": "जेमिनी",
        "computer": "कंप्यूटर",
        "laptop": "लैपटॉप",
        "setup": "सेटअप",
    }

    def __init__(self, data_dir: str | Path | None = None):
        # normalizer.py is inside language/speech/
        # JSON dictionaries are inside language/
        self.data_dir = (
            Path(data_dir).resolve()
            if data_dir
            else Path(__file__).resolve().parent.parent
        )

        self.roman = self._load("roman_hindi.json")
        self.phrases = self._load("phrases.json")
        self.english = self._load("english_terms.json")

        self.english_terms = {
            word.casefold()
            for word in self.english.get("preserve", [])
        }

        self.phrase_keys = sorted(
            self.phrases,
            key=len,
            reverse=True,
        )

    def _load(self, name: str) -> dict:
        path = self.data_dir / name

        if not path.exists():
            raise FileNotFoundError(
                f"Missing language dictionary: {path}"
            )

        with path.open(encoding="utf-8") as file:
            return json.load(file)

    def _replace_phrases(self, text: str) -> str:
        """Replace known multiword Roman Hindi phrases first."""

        for source in self.phrase_keys:
            pattern = rf"(?<!\w){re.escape(source)}(?!\w)"

            text = re.sub(
                pattern,
                lambda _: self.phrases[source],
                text,
                flags=re.IGNORECASE,
            )

        return text

    def to_hindi_tts(self, text: str) -> str:
        """
        Convert the complete Hinglish response into
        Devanagari speech text for a single Hindi voice.
        """

        if not text:
            return ""

        text = self._replace_phrases(text)
        tokens = self.TOKEN_RE.findall(text)
        output: list[str] = []

        for token in tokens:
            # Preserve punctuation.
            if re.fullmatch(r"[^\w\s]", token):
                if output:
                    output[-1] += token
                continue

            # Preserve existing Devanagari.
            if re.fullmatch(r"[\u0900-\u097F]+", token):
                output.append(token)
                continue

            # Keep numbers unchanged.
            if token.isdigit():
                output.append(token)
                continue

            key = token.casefold()

            # Roman Hindi takes priority over English phonetics.
            if key in self.roman:
                output.append(self.roman[key])

            elif key in self.ENGLISH_PHONETICS:
                output.append(self.ENGLISH_PHONETICS[key])

            else:
                # Unknown words are preserved.
                output.append(token)

        return " ".join(output)

    def to_hindi_segment(self, text: str) -> str:
        """
        Convert ONLY Roman Hindi words to Devanagari for Kokoro Hindi (hf_alpha).
        English words (WhatsApp, Chrome, open, message, etc.) stay in Latin script.
        """
        if not text:
            return ""

        text = self._replace_phrases(text)
        tokens = self.TOKEN_RE.findall(text)
        output: list[str] = []

        for token in tokens:
            # Preserve punctuation
            if re.fullmatch(r"[^\w\s]", token):
                if output:
                    output[-1] += token
                continue

            # Preserve existing Devanagari
            if re.fullmatch(r"[\u0900-\u097F]+", token):
                output.append(token)
                continue

            # Keep numbers unchanged
            if token.isdigit():
                output.append(token)
                continue

            key = token.casefold()

            # Roman Hindi -> Devanagari
            if key in self.roman:
                output.append(self.roman[key])
            else:
                # English & unknown words stay in Latin script
                output.append(token)

        return " ".join(output)

    @staticmethod
    def _append_segment(
        output: list[dict[str, str]],
        language: SegmentLanguage,
        text: str,
    ):
        text = text.strip()

        if not text:
            return

        if output and output[-1]["language"] == language:
            output[-1]["text"] += " " + text
        else:
            output.append({
                "language": language,
                "text": text,
            })

    def normalize(self, text: str) -> list[dict[str, str]]:
        """Return ordered Hindi and English speech segments."""

        if not text or not text.strip():
            return []

        text = self._replace_phrases(text)
        tokens = self.TOKEN_RE.findall(text)
        output: list[dict[str, str]] = []

        for token in tokens:
            # Punctuation
            if re.fullmatch(r"[^\w\s]", token):
                if output:
                    output[-1]["text"] += token
                continue

            # Existing Devanagari
            if re.fullmatch(r"[\u0900-\u097F]+", token):
                self._append_segment(output, "hi", token)
                continue

            # Numbers
            if token.isdigit():
                self._append_segment(output, "en", token)
                continue

            key = token.casefold()

            # Known Roman Hindi
            if key in self.roman:
                self._append_segment(
                    output,
                    "hi",
                    self.roman[key],
                )

            # Known English
            elif key in self.english_terms:
                self._append_segment(output, "en", token)

            # Unknown words: preserve rather than guess
            else:
                self._append_segment(output, "en", token)

        return self._clean_segments(output)

    @staticmethod
    def _clean_segments(
        segments: list[dict[str, str]],
    ) -> list[dict[str, str]]:

        for segment in segments:
            segment["text"] = re.sub(
                r"\s+([,.;:!?।])",
                r"\1",
                segment["text"],
            ).strip()

        return [
            segment
            for segment in segments
            if segment["text"]
        ]

    def to_debug_text(self, text: str) -> str:
        """Display the language segmentation."""

        return " | ".join(
            f"[{segment['language']}] {segment['text']}"
            for segment in self.normalize(text)
        )

    def to_speech_text(self, text: str) -> str:
        """Return normalized text for inspection."""

        return " ".join(
            segment["text"]
            for segment in self.normalize(text)
        )

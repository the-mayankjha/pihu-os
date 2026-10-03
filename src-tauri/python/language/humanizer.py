from __future__ import annotations

import json
import random
import re
from pathlib import Path
from typing import Any


class Humanizer:
    """Local-first English/Hindi/Hinglish vocabulary helper.

    This module deliberately does not translate arbitrary sentences. It normalizes
    known slang and exposes phrase alternatives for a response-generation layer.
    """

    def __init__(self, data_dir: str | Path | None = None, seed: int | None = None):
        self.data_dir = Path(data_dir) if data_dir else Path(__file__).parent
        self.whatsapp = self._load("whatsapp.json")
        self.hinglish = self._load("hinglish.json")
        self.vocabulary = self._load("vocabulary.json")
        self.random = random.Random(seed)
        self._reverse = self._build_reverse_map()

    def _load(self, filename: str) -> dict[str, Any]:
        path = self.data_dir / filename
        with path.open("r", encoding="utf-8") as file:
            return json.load(file)

    @staticmethod
    def _key(value: str) -> str:
        return re.sub(r"\s+", " ", value.strip().lower())

    def _build_reverse_map(self) -> dict[str, str]:
        reverse: dict[str, str] = {}
        categories = self.whatsapp.get("categories", {})
        for entries in categories.values():
            for canonical, variants in entries.items():
                reverse[self._key(canonical)] = canonical
                for variant in variants:
                    reverse[self._key(variant)] = canonical

        for canonical, variants in self.whatsapp.get("normalization", {}).get("variants", {}).items():
            reverse[self._key(canonical)] = variants
            reverse[self._key(variants)] = variants

        for canonical, variants in self.hinglish.get("phrases", {}).items():
            reverse[self._key(canonical)] = canonical
            for variant in variants:
                reverse[self._key(variant)] = canonical
        return reverse

    def normalize_token(self, token: str) -> str:
        """Normalize a known Roman-Hindi spelling, preserving unknown tokens."""
        key = self._key(token)
        variants = self.whatsapp.get("normalization", {}).get("variants", {})
        return variants.get(key, token)

    def normalize_text(self, text: str) -> str:
        """Normalize common Hinglish spellings without changing sentence meaning."""
        variants = self.whatsapp.get("normalization", {}).get("variants", {})
        if not text:
            return text

        # Longest-first, whole-word matching prevents replacing inside other words.
        result = text
        for source in sorted(variants, key=len, reverse=True):
            target = variants[source]
            result = re.sub(
                rf"(?<!\w){re.escape(source)}(?!\w)",
                lambda match: self._preserve_case(match.group(0), target),
                result,
                flags=re.IGNORECASE,
            )
        return result

    @staticmethod
    def _preserve_case(original: str, replacement: str) -> str:
        if original.isupper():
            return replacement.upper()
        if original[:1].isupper():
            return replacement[:1].upper() + replacement[1:]
        return replacement

    def alternatives(self, phrase: str) -> list[str]:
        """Return casual alternatives for a known English phrase."""
        key = self._key(phrase)
        overrides = self.vocabulary.get("overrides", {})
        learned = self.vocabulary.get("learned", {})

        if key in overrides:
            return list(overrides[key])
        if key in learned:
            return list(learned[key])

        for entries in self.whatsapp.get("categories", {}).values():
            if key in entries:
                return list(entries[key])

        if key in self.hinglish.get("phrases", {}):
            return list(self.hinglish["phrases"][key])
        return []

    def humanize_phrase(self, phrase: str, *, choice: str = "random") -> str:
        """Select one known casual alternative; unknown phrases pass through."""
        options = self.alternatives(phrase)
        if not options:
            return phrase
        if choice == "first":
            return options[0]
        if choice == "random":
            return self.random.choice(options)
        raise ValueError("choice must be 'first' or 'random'")

    def canonicalize_phrase(self, phrase: str) -> str | None:
        """Map a known slang/Hinglish phrase back to its canonical key."""
        return self._reverse.get(self._key(phrase))

    def learn(self, canonical_phrase: str, preferred_expression: str) -> None:
        """Save a user's preferred expression for a canonical phrase."""
        key = self._key(canonical_phrase)
        expression = preferred_expression.strip()
        if not key or not expression:
            raise ValueError("Both phrase and preferred expression are required.")

        learned = self.vocabulary.setdefault("learned", {})
        current = learned.setdefault(key, [])
        if expression not in current:
            current.insert(0, expression)
        self._save_vocabulary()

    def set_preference(self, name: str, value: Any) -> None:
        self.vocabulary.setdefault("preferences", {})[name] = value
        self._save_vocabulary()

    def _save_vocabulary(self) -> None:
        path = self.data_dir / "vocabulary.json"
        path.write_text(
            json.dumps(self.vocabulary, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        self._reverse = self._build_reverse_map()

    def get_style_prompt(self) -> str:
        """Return a compact style instruction to append to an LLM system prompt."""
        prefs = self.vocabulary.get("preferences", {})
        style = prefs.get("language_style", "casual_hinglish")
        script = prefs.get("script", "roman")
        intensity = prefs.get("slang_intensity", "light")
        emojis = prefs.get("use_emojis", False)
        return (
            f"Use {style} in {script} script. Slang intensity: {intensity}. "
            f"Use emojis: {'yes' if emojis else 'no'}. "
            "Sound natural and concise; do not force slang into every sentence. "
            "Preserve technical terms and the user's intended meaning."
        )

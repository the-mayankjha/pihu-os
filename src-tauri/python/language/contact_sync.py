"""
PIHU Contact Auto-Sync — Extracts WhatsApp + People Directory contacts,
uses Gemini LLM to generate Roman ↔ Devanagari transliterations with
spelling variations, and injects them into the language module.

Usage:
    # As a standalone script (one-shot sync):
    python contact_sync.py

    # From Python code:
    from language.contact_sync import ContactSyncer
    syncer = ContactSyncer(gemini_api_key="...")
    syncer.sync()
"""

import os
import re
import json
import time
import urllib.request
import urllib.error
import sqlite3
import logging
from pathlib import Path
from typing import Dict, List, Set, Optional, Any, Tuple

logger = logging.getLogger("pihu.contact_sync")

# ─── Constants ────────────────────────────────────────────────────────
WHATSAPP_API = "http://localhost:8080/api/chats"
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

# Names that are purely English / generic and don't need Hindi transliteration
SKIP_PATTERNS = re.compile(
    r"^[\d@#\.\*\~\-\+\!\?\^\=\•\♾\⚡\✨\❄\💫\💞\🙂\😎\😃]+$"
    r"|^status@"
    r"|@newsletter$"
    r"|@broadcast$"
    r"|^[\U00010000-\U0010FFFF\s]+$"  # emoji-only names
)

# Short or meaningless names to skip
MIN_NAME_LENGTH = 2

# Maximum contacts to process in a single Gemini batch (to stay within token limits)
GEMINI_BATCH_SIZE = 40

# Rate limit: wait between Gemini requests (seconds)
GEMINI_RATE_LIMIT = 1.5


def _is_indian_name(name: str) -> bool:
    """Heuristic: does this name likely need Hindi/Devanagari transliteration?"""
    clean = name.strip()
    if not clean or len(clean) < MIN_NAME_LENGTH:
        return False
    # Skip emoji-only, numeric-only, or special character names
    if SKIP_PATTERNS.search(clean):
        return False
    # Skip names that are purely in non-Latin/non-Devanagari scripts
    # (Telugu, Malayalam, Arabic, etc.) — we only transliterate Roman ↔ Devanagari
    has_latin = bool(re.search(r"[A-Za-z]", clean))
    has_devanagari = bool(re.search(r"[\u0900-\u097F]", clean))
    # If it has Devanagari, we want to generate Roman form
    if has_devanagari:
        return True
    # If it has Latin characters, it's a candidate
    if has_latin:
        return True
    return False


def _clean_contact_name(name: str) -> str:
    """Remove emojis, special chars, trailing dots/tildes for cleaner LLM input."""
    clean = name.strip()
    # Remove leading/trailing special chars like ~, ., *, ^
    clean = re.sub(r"^[~\.\*\^_\-\+]+|[~\.\*\^_\-\+]+$", "", clean).strip()
    # Remove emoji sequences (keep text)
    clean = re.sub(
        r"[\U0001F300-\U0001F9FF\U0001FA00-\U0001FA6F\U0001FA70-\U0001FAFF"
        r"\U00002702-\U000027B0\U000024C2-\U0001F251\U0000FE0F\U0000200D]+",
        "", clean
    ).strip()
    return clean


class ContactSyncer:
    """
    Auto-syncs WhatsApp + People Directory contacts into the PIHU language module.
    Uses Gemini LLM to generate Roman ↔ Devanagari transliterations + variations.
    """

    def __init__(
        self,
        gemini_api_key: Optional[str] = None,
        data_dir: Optional[str] = None,
    ):
        self.data_dir = Path(data_dir) if data_dir else Path(__file__).resolve().parent
        self.gemini_api_key = gemini_api_key or self._discover_api_key()
        self.contact_vocab_path = self.data_dir / "contact_vocabulary.json"
        self.roman_hindi_path = self.data_dir / "roman_hindi.json"

    def _discover_api_key(self) -> str:
        """Try to find a Gemini API key from environment or .env files."""
        # 1. Direct env var
        for env_key in ["PIHU_GEMINI_API_KEY", "GEMINI_API_KEY", "VITE_GEMINI_API_KEYS"]:
            val = os.environ.get(env_key, "")
            if val:
                # VITE_GEMINI_API_KEYS may be comma-separated
                return val.split(",")[0].strip()

        # 2. .env files in project
        env_paths = [
            self.data_dir.parent.parent.parent / ".env",  # project root .env
            self.data_dir.parent.parent / "pihu_mcps" / ".env",  # MCPs .env
            Path.home() / ".pihu" / ".env",
        ]
        for env_path in env_paths:
            if env_path.exists():
                try:
                    with open(env_path, "r") as f:
                        for line in f:
                            line = line.strip()
                            if line.startswith("#") or "=" not in line:
                                continue
                            key, val = line.split("=", 1)
                            key = key.strip()
                            val = val.strip().strip('"').strip("'")
                            if key in ("PIHU_GEMINI_API_KEY", "PIHU_GEMINI_API_KEY2",
                                       "PIHU_GEMINI_API_KEY3", "GEMINI_API_KEY",
                                       "VITE_GEMINI_API_KEYS"):
                                if val and val != "your_key_1,your_key_2,your_key_3":
                                    return val.split(",")[0].strip()
                except Exception:
                    pass

        logger.warning("No Gemini API key found. Set PIHU_GEMINI_API_KEY env var.")
        return ""

    def extract_contacts(self) -> List[Dict[str, Any]]:
        """Extract all contacts from WhatsApp bridge, DB, and People Directory."""
        contacts: List[Dict[str, Any]] = []
        seen: Set[str] = set()

        # 1. WhatsApp Bridge live API
        try:
            req = urllib.request.Request(
                WHATSAPP_API,
                headers={"User-Agent": "PIHU-ContactSync"}
            )
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                for chat in data.get("chats", []):
                    name = (chat.get("name") or "").strip()
                    jid = (chat.get("jid") or "").strip()
                    is_group = bool(chat.get("is_group"))
                    if not name or name.lower() in seen:
                        continue
                    seen.add(name.lower())
                    contacts.append({
                        "name": name,
                        "jid": jid,
                        "is_group": is_group,
                        "source": "whatsapp_bridge",
                    })
        except Exception as e:
            logger.warning(f"WhatsApp bridge unreachable: {e}")

        # 2. SQLite database fallback
        db_paths = [
            os.path.expanduser("~/.pihu/whatsapp/messages.db"),
            str(self.data_dir.parent.parent / "pihu_mcps" / "mcp" / "servers"
                / "pihu-whatsapp-mcp" / "whatsapp-bridge" / "store" / "messages.db"),
        ]
        for db_p in db_paths:
            if os.path.exists(db_p):
                try:
                    conn = sqlite3.connect(db_p)
                    cur = conn.cursor()
                    cur.execute("SELECT jid, name FROM chats WHERE name IS NOT NULL AND name != ''")
                    for jid, name in cur.fetchall():
                        n = name.strip()
                        if n and n.lower() not in seen:
                            seen.add(n.lower())
                            contacts.append({
                                "name": n,
                                "jid": jid,
                                "is_group": jid.endswith("@g.us"),
                                "source": "whatsapp_db",
                            })
                    conn.close()
                except Exception as e:
                    logger.debug(f"DB {db_p}: {e}")

        # 3. People Directory (contacts.json)
        contact_files = [
            os.path.expanduser("~/.pihu/contacts.json"),
            str(self.data_dir.parent.parent / "contacts.json"),
        ]
        for p in contact_files:
            if os.path.exists(p):
                try:
                    with open(p, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        clist = data if isinstance(data, list) else data.get("contacts", [])
                        for c in clist:
                            name = c.get("name", "").strip()
                            nick = (c.get("nickname") or "").strip()
                            if name and name.lower() not in seen:
                                seen.add(name.lower())
                                contacts.append({
                                    "name": name,
                                    "nickname": nick,
                                    "jid": c.get("whatsappJid", ""),
                                    "is_group": False,
                                    "source": "people_directory",
                                })
                except Exception:
                    pass

        logger.info(f"Extracted {len(contacts)} total contacts")
        return contacts

    def filter_transliterable_names(self, contacts: List[Dict[str, Any]]) -> List[str]:
        """Filter contact names that are candidates for transliteration."""
        names: List[str] = []
        seen: Set[str] = set()

        for c in contacts:
            raw_name = c.get("name", "")
            clean = _clean_contact_name(raw_name)
            if not clean or clean.lower() in seen:
                continue
            if not _is_indian_name(clean):
                continue
            seen.add(clean.lower())
            names.append(clean)

            # Also process nickname if present
            nick = _clean_contact_name(c.get("nickname", ""))
            if nick and nick.lower() not in seen and _is_indian_name(nick):
                seen.add(nick.lower())
                names.append(nick)

        logger.info(f"Filtered to {len(names)} transliterable names")
        return names

    def _gemini_transliterate_batch(self, names: List[str]) -> Dict[str, Dict]:
        """
        Call Gemini to generate transliterations for a batch of names.
        Returns dict: { "clean_name": { "devanagari": "...", "variations": [...] }, ... }
        """
        if not self.gemini_api_key:
            logger.error("No Gemini API key — cannot transliterate")
            return {}

        prompt = f"""You are a Hindi-English transliteration expert for an Indian voice assistant called PIHU.

Given these contact names (mostly Indian names written in Roman/English script), generate:
1. The most accurate Devanagari (Hindi) transliteration for each name
2. Common spelling variations that a speech-to-text system might produce (Roman English variations)

Rules:
- For Indian names like "Mayank" → "मयंक", "Piyush" → "पीयूष", "Rakhi" → "राखी"
- For relation-based names like "Pappa" → "पप्पा", "Rakhi Didi" → "राखी दीदी"
- Include common STT misspellings: doubled consonants (pp/p), long/short vowels (aa/a, ee/i)
- For compound names like "Piyush Jha", also include parts: "piyush", "jha"
- For group names or English-only names (like "Study Materials"), set devanagari to empty string ""
- Only generate Hindi Devanagari transliterations, not Telugu/Tamil/Malayalam/etc.
- If a name is purely English (like "Prince", "Grace"), provide the Hinglish pronunciation in Devanagari

Respond with ONLY a valid JSON object (no markdown, no explanation), in this exact format:
{{
  "name_here": {{
    "devanagari": "देवनागरी",
    "variations": ["variation1", "variation2"]
  }}
}}

Contact names to transliterate:
{json.dumps(names, ensure_ascii=False)}"""

        body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 8192,
                "responseMimeType": "application/json",
            }
        }

        url = f"{GEMINI_API_URL}?key={self.gemini_api_key}"
        req_data = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=req_data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read().decode("utf-8"))

            # Extract text from Gemini response
            candidates = result.get("candidates", [])
            if not candidates:
                logger.error("Gemini returned no candidates")
                return {}

            text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            if not text:
                logger.error("Gemini returned empty text")
                return {}

            # Clean the response — strip markdown fences if present
            text = text.strip()
            if text.startswith("```"):
                text = re.sub(r"^```(?:json)?\s*", "", text)
                text = re.sub(r"\s*```$", "", text)

            parsed = json.loads(text)
            return parsed

        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8", errors="replace")
            logger.error(f"Gemini API error {e.code}: {error_body[:200]}")
            return {}
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini JSON response: {e}")
            return {}
        except Exception as e:
            logger.error(f"Gemini request failed: {e}")
            return {}

    def generate_transliterations(self, names: List[str]) -> Dict[str, Dict]:
        """
        Process all names through Gemini in batches.
        Returns merged dict of all transliterations.
        """
        all_results: Dict[str, Dict] = {}

        # Process in batches
        for i in range(0, len(names), GEMINI_BATCH_SIZE):
            batch = names[i:i + GEMINI_BATCH_SIZE]
            batch_num = (i // GEMINI_BATCH_SIZE) + 1
            total_batches = (len(names) + GEMINI_BATCH_SIZE - 1) // GEMINI_BATCH_SIZE
            logger.info(f"Processing batch {batch_num}/{total_batches} ({len(batch)} names)")

            result = self._gemini_transliterate_batch(batch)
            all_results.update(result)

            # Rate limit between batches
            if i + GEMINI_BATCH_SIZE < len(names):
                time.sleep(GEMINI_RATE_LIMIT)

        logger.info(f"Generated transliterations for {len(all_results)} names")
        return all_results

    def merge_to_vocabulary(self, transliterations: Dict[str, Dict]) -> Tuple[int, int]:
        """
        Merge transliterations into contact_vocabulary.json and roman_hindi.json.
        Returns (new_entries_count, updated_entries_count).
        """
        # Load existing contact vocabulary
        existing_vocab: Dict[str, Any] = {}
        if self.contact_vocab_path.exists():
            try:
                with open(self.contact_vocab_path, "r", encoding="utf-8") as f:
                    existing_vocab = json.load(f)
            except Exception:
                pass

        # Load existing roman_hindi
        existing_roman: Dict[str, str] = {}
        if self.roman_hindi_path.exists():
            try:
                with open(self.roman_hindi_path, "r", encoding="utf-8") as f:
                    existing_roman = json.load(f)
            except Exception:
                pass

        new_count = 0
        updated_count = 0

        # Build merged vocabulary
        contact_entries: Dict[str, Any] = existing_vocab.copy()

        for name, data in transliterations.items():
            devanagari = (data.get("devanagari") or "").strip()
            variations = data.get("variations", [])

            if not devanagari:
                continue

            name_lower = name.strip().lower()

            # Update contact_vocabulary.json
            if name_lower not in contact_entries:
                new_count += 1
            else:
                # Merge variations
                old_vars = set(contact_entries[name_lower].get("variations", []))
                new_vars = set(variations)
                if new_vars - old_vars:
                    updated_count += 1
                    variations = list(old_vars | new_vars)

            contact_entries[name_lower] = {
                "devanagari": devanagari,
                "variations": variations,
                "source": "auto_sync",
            }

            # Also inject into roman_hindi.json mappings
            # Primary name → Devanagari
            if name_lower not in existing_roman:
                existing_roman[name_lower] = devanagari

            # Each variation → same Devanagari
            for var in variations:
                var_clean = var.strip().lower()
                if var_clean and var_clean not in existing_roman:
                    existing_roman[var_clean] = devanagari

            # For multi-word names, also add individual parts
            parts = name_lower.split()
            if len(parts) > 1:
                dev_parts = devanagari.split()
                for j, part in enumerate(parts):
                    if part not in existing_roman and j < len(dev_parts):
                        existing_roman[part] = dev_parts[j]

        # Write contact_vocabulary.json
        with open(self.contact_vocab_path, "w", encoding="utf-8") as f:
            json.dump(contact_entries, f, ensure_ascii=False, indent=2)

        # Write updated roman_hindi.json
        with open(self.roman_hindi_path, "w", encoding="utf-8") as f:
            json.dump(existing_roman, f, ensure_ascii=False, indent=2)

        logger.info(
            f"Vocabulary updated: {new_count} new, {updated_count} updated. "
            f"Total contact entries: {len(contact_entries)}, "
            f"Total roman_hindi entries: {len(existing_roman)}"
        )
        return new_count, updated_count

    def sync(self, force: bool = False) -> Dict[str, Any]:
        """
        Full sync pipeline:
        1. Extract contacts
        2. Filter transliterable names
        3. Generate transliterations via Gemini
        4. Merge into vocabulary files

        Args:
            force: If True, re-transliterate names even if they exist in vocabulary.

        Returns:
            Summary dict with counts and status.
        """
        logger.info("Starting contact auto-sync...")
        start = time.time()

        # Step 1: Extract contacts
        contacts = self.extract_contacts()
        if not contacts:
            return {"status": "no_contacts", "message": "No contacts found"}

        # Step 2: Filter transliterable names
        all_names = self.filter_transliterable_names(contacts)
        if not all_names:
            return {"status": "no_names", "message": "No transliterable names found"}

        # Step 3: Skip already-known names unless force=True
        if not force and self.contact_vocab_path.exists():
            try:
                with open(self.contact_vocab_path, "r", encoding="utf-8") as f:
                    existing = json.load(f)
                known = set(existing.keys())
                new_names = [n for n in all_names if n.strip().lower() not in known]
                logger.info(f"Skipping {len(all_names) - len(new_names)} already-known names")
                all_names = new_names
            except Exception:
                pass

        if not all_names:
            return {
                "status": "up_to_date",
                "message": "All contacts already synced",
                "total_contacts": len(contacts),
            }

        # Step 4: Generate transliterations
        if not self.gemini_api_key:
            return {"status": "error", "message": "No Gemini API key available"}

        transliterations = self.generate_transliterations(all_names)
        if not transliterations:
            return {"status": "error", "message": "Gemini transliteration failed"}

        # Step 5: Merge into vocabulary
        new_count, updated_count = self.merge_to_vocabulary(transliterations)

        elapsed = time.time() - start
        summary = {
            "status": "success",
            "total_contacts": len(contacts),
            "names_processed": len(all_names),
            "transliterations_generated": len(transliterations),
            "new_entries": new_count,
            "updated_entries": updated_count,
            "elapsed_seconds": round(elapsed, 1),
        }
        logger.info(f"Contact sync complete: {summary}")
        return summary

    def get_vocabulary(self) -> Dict[str, Any]:
        """Load the current contact vocabulary."""
        if self.contact_vocab_path.exists():
            with open(self.contact_vocab_path, "r", encoding="utf-8") as f:
                return json.load(f)
        return {}


# ─── CLI Entry Point ──────────────────────────────────────────────────
if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s"
    )

    syncer = ContactSyncer()
    result = syncer.sync()

    print("\n" + "=" * 60)
    print("PIHU Contact Sync Results")
    print("=" * 60)
    for k, v in result.items():
        print(f"  {k}: {v}")
    print("=" * 60)

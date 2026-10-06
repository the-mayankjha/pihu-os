"""
PIHU Contact & Language Bridge — Roman <-> Devanagari Transliteration,
Alias Normalization, and Multi-source Contact Extractor for STT & TTS.
"""

import os
import re
import json
import sqlite3
import urllib.request
import urllib.error
from pathlib import Path
from typing import Dict, List, Set, Optional, Tuple, Any

# Common Indic Family and Relationship Canonical Aliases
RELATION_ALIASES: Dict[str, List[str]] = {
    "papa": [
        "papa", "pappa", "paapa", "pa", "pawpa", "dad", "daddy", "pitaji", "pita ji",
        "bauji", "bapu", "father", "पापा", "पप्पा", "पिताजी", "बापू", "बाऊजी"
    ],
    "mummy": [
        "mummy", "mumma", "maa", "ma", "mataji", "mata ji", "mom", "mommy",
        "aai", "ammi", "mother", "मम्मी", "माँ", "माताजी", "अम्मी", "आई"
    ],
    "bhaiya": [
        "bhaiya", "bhai", "bhaya", "bhiya", "bro", "brother", "veer",
        "भैया", "भाई", "वीर"
    ],
    "didi": [
        "didi", "behen", "behna", "dee dee", "sister", "sis",
        "दीदी", "बहन", "बहना"
    ],
    "chacha": ["chacha", "chachu", "kaka", "चाचा", "चाचू", "काका"],
    "chachi": ["chachi", "kaki", "चाची", "काकी"],
    "mama": ["mama", "mamaji", "मामा", "मामाजी"],
    "mami": ["mami", "mamiji", "मामी", "मामीजी"],
    "dada": ["dada", "dadaji", "दादा", "दादाजी", "grandpa", "grandfather"],
    "dadi": ["dadi", "dadiji", "दादी", "दादीजी", "grandma", "grandmother"],
    "nana": ["nana", "nanaji", "नाना", "नानाजी"],
    "nani": ["nani", "naniji", "नानी", "नानीजी"],
    "bhabhi": ["bhabhi", "भाभी"],
    "jiju": ["jiju", "jija", "jijaji", "जीजू", "जीजाजी"],
    "dost": ["dost", "friend", "yaar", "yar", "दोस्त", "यार"],
}

# Rule-based Roman to Devanagari Basic Mapping Table
ROMAN_TO_DEVANAGARI = {
    "sh": "श", "ch": "च", "th": "थ", "dh": "ध", "bh": "भ", "kh": "ख", "gh": "घ",
    "jh": "झ", "ph": "फ", "gn": "ज्ञ", "gy": "ज्ञ", "tr": "त्र", "ks": "क्ष",
    "k": "क", "g": "ग", "c": "क", "j": "ज", "t": "त", "d": "द", "n": "न",
    "p": "प", "b": "ब", "m": "म", "y": "य", "r": "र", "l": "ल", "v": "व",
    "w": "व", "s": "स", "h": "ह", "f": "फ़", "z": "ज़",
    "aa": "आ", "ee": "ई", "oo": "ऊ", "ai": "ऐ", "au": "औ",
    "a": "ा", "i": "ि", "u": "ु", "e": "े", "o": "ो",
}

# Devanagari to Roman Basic Mapping Table
DEVANAGARI_TO_ROMAN = {
    "अ": "a", "आ": "aa", "इ": "i", "ई": "ee", "उ": "u", "ऊ": "oo", "ए": "e", "ऐ": "ai",
    "ओ": "o", "औ": "au", "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "च": "ch", "छ": "chh",
    "ज": "j", "झ": "jh", "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n", "त": "t",
    "थ": "th", "द": "d", "ध": "dh", "न": "n", "प": "p", "फ": "ph", "ब": "b", "भ": "bh",
    "म": "m", "य": "y", "र": "r", "ल": "l", "व": "v", "श": "sh", "ष": "sh", "स": "s",
    "ह": "h", "ा": "a", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo", "े": "e", "ै": "ai",
    "ो": "o", "ौ": "au", "्": "", "ं": "n", "ँ": "n", "ः": "h",
}


def transliterate_devanagari_to_roman(text: str) -> str:
    """Convert Devanagari text to Roman phonetic Hindi."""
    res = []
    for ch in text:
        res.append(DEVANAGARI_TO_ROMAN.get(ch, ch))
    return "".join(res).lower()


class ContactLanguageBridge:
    """
    Bridge connecting WhatsApp contacts, People Directory contacts.json,
    Roman <-> Devanagari vocabulary, and STT / TTS phonetic normalization.
    """

    def __init__(self, data_dir: Optional[str] = None):
        self.data_dir = Path(data_dir) if data_dir else Path(__file__).resolve().parent
        self.contacts_cache: List[Dict[str, Any]] = []
        self.alias_map: Dict[str, str] = {}  # variant -> canonical
        self.devanagari_map: Dict[str, str] = {}  # roman -> devanagari
        self._build_alias_tables()

    def _build_alias_tables(self):
        """Construct bidirectional lookup tables for all known relationships."""
        for canonical, variants in RELATION_ALIASES.items():
            for v in variants:
                clean_v = v.strip().lower()
                self.alias_map[clean_v] = canonical

        # Load roman_hindi.json if available
        roman_file = self.data_dir / "roman_hindi.json"
        if roman_file.exists():
            try:
                with open(roman_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for r_word, d_word in data.items():
                        r_clean = r_word.strip().lower()
                        self.devanagari_map[r_clean] = d_word
                        # Also register devanagari -> roman
                        self.alias_map[d_word.strip()] = r_clean
                        self.alias_map[r_clean] = r_clean
            except Exception:
                pass

        # Load auto-synced contact vocabulary (from contact_sync.py)
        vocab_file = self.data_dir / "contact_vocabulary.json"
        if vocab_file.exists():
            try:
                with open(vocab_file, "r", encoding="utf-8") as f:
                    vocab = json.load(f)
                    for name, entry in vocab.items():
                        dev = entry.get("devanagari", "")
                        if not dev:
                            continue
                        n_clean = name.strip().lower()
                        self.devanagari_map[n_clean] = dev
                        self.alias_map[n_clean] = n_clean
                        self.alias_map[dev.strip()] = n_clean
                        # Register variations
                        for var in entry.get("variations", []):
                            v_clean = var.strip().lower()
                            if v_clean:
                                self.devanagari_map[v_clean] = dev
                                self.alias_map[v_clean] = n_clean
            except Exception:
                pass

    def trigger_sync(self, gemini_api_key: Optional[str] = None, force: bool = False) -> Dict[str, Any]:
        """
        Trigger a contact auto-sync: extract contacts, transliterate via Gemini,
        and inject into vocabulary files. Rebuilds alias tables after sync.
        """
        from .contact_sync import ContactSyncer
        syncer = ContactSyncer(
            gemini_api_key=gemini_api_key,
            data_dir=str(self.data_dir)
        )
        result = syncer.sync(force=force)
        # Rebuild lookup tables with new data
        self.alias_map.clear()
        self.devanagari_map.clear()
        self._build_alias_tables()
        return result

    def eject_all_contacts(self) -> List[Dict[str, Any]]:
        """
        Auto-eject all contacts from:
        1. ~/.pihu/contacts.json & project contacts.json
        2. Live WhatsApp Bridge (:8080/api/chats)
        3. Local SQLite message database
        """
        results: List[Dict[str, Any]] = []
        seen_identifiers: Set[str] = set()

        # 1. Local contacts.json files
        contact_files = [
            os.path.expanduser("~/.pihu/contacts.json"),
            os.path.join(os.getcwd(), "src-tauri", "contacts.json"),
            os.path.join(os.getcwd(), "contacts.json"),
        ]

        for p in contact_files:
            if os.path.exists(p):
                try:
                    with open(p, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        contacts_list = data if isinstance(data, list) else data.get("contacts", [])
                        for c in contacts_list:
                            name = c.get("name", "").strip()
                            nick = (c.get("nickname") or "").strip()
                            phone = c.get("phone", "").strip()
                            jid = c.get("whatsappJid", "")
                            identifier = (name + "_" + phone).lower()

                            if identifier and identifier not in seen_identifiers:
                                seen_identifiers.add(identifier)
                                results.append({
                                    "name": name,
                                    "nickname": nick,
                                    "phone": phone,
                                    "jid": jid,
                                    "source": "People Directory",
                                    "roman": name.lower(),
                                    "devanagari": self.get_devanagari(name),
                                    "aliases": self.get_contact_aliases(name, nick)
                                })
                except Exception:
                    pass

        # 2. Query Live WhatsApp Bridge (/api/chats)
        try:
            req = urllib.request.Request("http://localhost:8080/api/chats", headers={"User-Agent": "PIHU-Language-Bridge"})
            with urllib.request.urlopen(req, timeout=1.2) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                for chat in data.get("chats", []):
                    c_name = (chat.get("name") or "").strip()
                    c_jid = (chat.get("jid") or "").strip()
                    if c_name and c_name.lower() not in seen_identifiers:
                        seen_identifiers.add(c_name.lower())
                        results.append({
                            "name": c_name,
                            "nickname": "",
                            "phone": c_jid.split("@")[0] if not chat.get("is_group") else "",
                            "jid": c_jid,
                            "is_group": bool(chat.get("is_group")),
                            "source": "WhatsApp Bridge",
                            "roman": c_name.lower(),
                            "devanagari": self.get_devanagari(c_name),
                            "aliases": self.get_contact_aliases(c_name)
                        })
        except Exception:
            pass

        # 3. SQLite message database fallback
        db_paths = [
            os.path.expanduser("~/.pihu/whatsapp/messages.db"),
            "src-tauri/pihu_mcps/mcp/servers/pihu-whatsapp-mcp/whatsapp-bridge/store/messages.db",
            "store/messages.db",
        ]
        for db_p in db_paths:
            if os.path.exists(db_p):
                try:
                    conn = sqlite3.connect(db_p)
                    cur = conn.cursor()
                    cur.execute("SELECT jid, name FROM chats WHERE name IS NOT NULL AND name != ''")
                    for jid, name in cur.fetchall():
                        n_clean = name.strip()
                        if n_clean.lower() not in seen_identifiers:
                            seen_identifiers.add(n_clean.lower())
                            results.append({
                                "name": n_clean,
                                "nickname": "",
                                "phone": jid.split("@")[0] if not jid.endswith("@g.us") else "",
                                "jid": jid,
                                "is_group": jid.endswith("@g.us"),
                                "source": "WhatsApp Database",
                                "roman": n_clean.lower(),
                                "devanagari": self.get_devanagari(n_clean),
                                "aliases": self.get_contact_aliases(n_clean)
                            })
                    conn.close()
                except Exception:
                    pass

        self.contacts_cache = results
        return results

    def get_devanagari(self, word: str) -> str:
        """Return Devanagari translation or phonetic representation of a name/word."""
        w_lower = word.strip().lower()
        if w_lower in self.devanagari_map:
            return self.devanagari_map[w_lower]

        # Check relation aliases
        for canonical, variants in RELATION_ALIASES.items():
            if w_lower in variants or w_lower == canonical:
                for v in variants:
                    if re.search(r"[\u0900-\u097F]", v):
                        return v

        return word

    def get_contact_aliases(self, name: str, nickname: str = "") -> List[str]:
        """Generate all spelling, phonetic, and Devanagari variants for a contact name."""
        variants: Set[str] = set()
        clean_name = name.strip().lower()
        clean_nick = nickname.strip().lower()

        variants.add(clean_name)
        if clean_nick:
            variants.add(clean_nick)

        # Check if name is a known relation (e.g. Papa, Mummy, Bhaiya)
        for canonical, alias_list in RELATION_ALIASES.items():
            if clean_name in alias_list or clean_name == canonical or (clean_nick and clean_nick in alias_list):
                for a in alias_list:
                    variants.add(a.lower())

        # Add double-consonant variations (e.g. papa <-> pappa)
        if "pp" in clean_name:
            variants.add(clean_name.replace("pp", "p"))
        elif "p" in clean_name:
            variants.add(clean_name.replace("p", "pp"))

        if "aa" in clean_name:
            variants.add(clean_name.replace("aa", "a"))
        elif "a" in clean_name:
            variants.add(clean_name.replace("a", "aa"))

        return list(variants)

    def normalize_speech_input(self, raw_transcript: str) -> str:
        """
        Normalizes STT transcript to correct common speech-to-text misspellings,
        Hinglish pronunciation artifacts, and contact aliases.
        
        Examples:
        - "Can you message for pa saying hi?" -> "Can you message papa saying hi?"
        - "She sent it to papa, P-A-W-P-A" -> "Send it to papa"
        - "message pappa that I am coming" -> "message papa that I am coming"
        - "bhai ko message karo" -> "bhaiya ko message karo"
        """
        if not raw_transcript or not raw_transcript.strip():
            return raw_transcript

        text = raw_transcript.strip()

        # Fix spelling out spellings like "P-A-W-P-A", "P-A-P-A", "P A P A"
        text = re.sub(r"\b([A-Za-z])[- ]([A-Za-z])[- ]([A-Za-z])[- ]([A-Za-z])(?:[- ]([A-Za-z]))?\b",
                      lambda m: "".join(filter(None, m.groups())).lower(), text)

        # Normalize common STT mistranscriptions for Indian relations/contacts
        mistranscriptions = [
            (r"\b(?:for\s+pa|for\s+pawpa|to\s+pa|to\s+pawpa)\b", "to papa"),
            (r"\b(?:pappa|paapa|pawpa|paw pa|p a p a|p a w p a)\b", "papa"),
            (r"\b(?:mumma|mommy|moma|mum)\b", "mummy"),
            (r"\b(?:bhaya|bhiya)\b", "bhaiya"),
            (r"\b(?:dee\s*dee|didi)\b", "didi"),
            (r"\b(?:mayank\s+kumar\s+jha|mayank\s+jha)\b", "Mayank"),
            (r"\b(?:पीहू|pewho|p\s+who)\b", "pihu"),
            (r"\b(?:पापा|पप्पा|पिताजी)\b", "papa"),
            (r"\b(?:मम्मी|माँ|माताजी)\b", "mummy"),
            (r"\b(?:भैया|भाई)\b", "bhaiya"),
            (r"\b(?:दीदी|बहन)\b", "didi"),
        ]

        for pattern, repl in mistranscriptions:
            text = re.sub(pattern, repl, text, flags=re.IGNORECASE)

        # Ensure "she sent it to" or "she send it to" -> "send it to" when user repeats command
        text = re.sub(r"^(?:she\s+sent\s+it\s+to|she\s+send\s+it\s+to|he\s+sent\s+it\s+to|please\s+send\s+it\s+to)\b", "send message to", text, flags=re.IGNORECASE)

        return text.strip()

    def is_matching_contact(self, query: str, contact_name: str, nickname: str = "") -> bool:
        """Returns True if the spoken query matches the contact name across Roman, Devanagari, or aliases."""
        q_clean = query.strip().lower()
        c_clean = contact_name.strip().lower()
        n_clean = nickname.strip().lower()

        if not q_clean or not c_clean:
            return False

        # Direct exact match
        if q_clean == c_clean or (n_clean and q_clean == n_clean):
            return True

        # Check relation canonical aliases
        for canonical, alias_list in RELATION_ALIASES.items():
            alias_lower = [a.lower() for a in alias_list]
            if (q_clean in alias_lower or q_clean == canonical) and (c_clean in alias_lower or c_clean == canonical or (n_clean and (n_clean in alias_lower or n_clean == canonical))):
                return True

        # Devanagari match
        q_dev = self.get_devanagari(q_clean)
        c_dev = self.get_devanagari(c_clean)
        if q_dev and c_dev and q_dev == c_dev:
            return True

        return False


# Singleton instance
bridge = ContactLanguageBridge()

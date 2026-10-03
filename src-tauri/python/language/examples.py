from pathlib import Path
from humanizer import Humanizer

engine = Humanizer(Path(__file__).parent, seed=7)

print(engine.normalize_text("hnn, kr do aur bta dena"))
print(engine.humanize_phrase("yes", choice="first"))
print(engine.humanize_phrase("what do you mean", choice="first"))
print(engine.canonicalize_phrase("wdym"))

# Save a user preference; this persists in vocabulary.json.
engine.learn("do it", "kr de")
print(engine.humanize_phrase("do it", choice="first"))
print(engine.get_style_prompt())

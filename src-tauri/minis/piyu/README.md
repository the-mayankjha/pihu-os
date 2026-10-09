# Piyu

Created using Pets create-pet and built-in imagegen from the supplied reference.

73-frame transparent v2 atlas: nine standard animation states and sixteen gaze directions. Eight plain-speaking mouth frames are separate from waving. Eight paired Mayank activities have four frames each: talking, looking/blinking, handshake, hug, cheek touch, laughing, smiling and high-five.

Piyu and Mayank interact continuously while nearby. Mayank approaches; Piyu stays anchored. TTS faces Piyu toward the user and interrupts contact. Nearby interaction resumes after speech. Moving either away stops it. Pihu retains separate artwork. Reduced motion avoids approach/contact motion. Partners must use equal mini sizes.

ChatGPT Pets uses only the 11-row atlas. Detailed pair animations and speech extensions run in pihu-os. The current active ChatGPT pet remains Pihu. Piyu is created in the pet library. No Library connector was available; originals, prompts, QA reports and previews are saved locally.

Verification: bundled structural/quality/preflight and three blind reviews passed; some intermediate gaze angles have reviewed subtlety/continuity warnings. 22 focused tests, TypeScript, ESLint and Vite build passed. Browser tested all eight actions, anchoring, TTS interruption/resumption and separation. Native window movement needs an in-app check.

Exact prompts are under prompts/ and each interactions/*/prompt.txt. Asset dimensions follow the Pets/runtime contracts; the high-resolution generated sources are preserved in decoded/ and interactions/*/source.png.

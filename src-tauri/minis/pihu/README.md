# Pihu

Created and selected using Pets. Stable ID: pet_6ac800da7b64819184d6fbd8f513aff4.

## Selected pet

`final/spritesheet-extended.png` is the validated transparent 1536×2288 v2 sheet (73 populated frames, 192×208 cells).

- Idle breathing and blink
- Running right and left
- Speaking wave greeting
- Success celebration jump
- Error / failed reaction
- Expectant pout
- Cat interaction: paw touch, nuzzle and petting
- Hair flip / checking gesture
- Sixteen look directions

High-resolution generated source strips are retained in `decoded/`; prompts and references are saved. Final previews include all states GIF and MP4, per-state GIFs, idle-jump-idle, look loop and labeled stills.

## Plain talking is separate

`final/pihu-tts-mouth-strip.png`, `final/pihu-tts-visemes.gif`, `final/pihu-tts-visemes.json`, and `final/tts-visemes/` contain a relaxed, arms-down talking sequence. It is separate from the waving greeting. Mouth poses: rest, MBP, AA, EE, OH, OO, FV, L. FV and L are approximate illustrated shapes.

These are animation assets. The available Pets connector has no talking-state slot or TTS audio callback, so plain talking is not automatically triggered by agent speech and real-time lip sync is not connected. A runtime integration must consume audio/phoneme timing and select the corresponding local mouth pose. Cross-pet interaction behavior is also not exposed through this connector; cat interaction is drawn into the active-work animation.

## Validation

Bundled extraction, atlas validation and pet-quality gate pass. Pets MCP preflight confirms valid:true. Independent direction reviewers confirm all four cardinals. Some intermediate gaze angles are subtle and angular spacing varies; these are recorded as reviewed warnings in `qa/`. No missing cells, clipped frames or alpha holes were detected.

Created with the built-in image_gen tool; prompt set in `prompts/` and extra prompt revisions with the corresponding assets. Library connector was unavailable; all workflow artifacts are preserved locally.

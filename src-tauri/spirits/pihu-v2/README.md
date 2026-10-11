# Pihu v2

Pihu v2 is the corrected character design supplied by Mayank: curly dark high ponytail with pink scrunchie, pink glasses, bindi, silver jhumkas, floral cream kurti, loose pale-blue trousers and pink-and-white shoes. This package is separate from the existing Pihu design.

## PIHU OS assets

- spritesheet-extended.png: 73-frame, 192×208-cell atlas (idle, movement, waving, jumping, failed, waiting, focused running, review and 16 look directions).
- states/thinking.png: six-frame transparent thinking loop for PIHU OS. The six full-body poses have uncrossed legs and both shoes planted.
- states/listening.png: ten-frame transparent headphone sequence. Frames 4–8 show open, half, closed, half-open and open eyes for a smooth blink; frames 8–10 continue with listening, removal and a relaxed hold. White headphones and a planted stance throughout.
- final/tts-visemes/: eight transparent mouth animation frames for speech.
- pet.json: PIHU OS catalog metadata.
- pihu-v2-states.json: animation/state map.
- references/ and qa/: canonical identity reference, source thinking strip and atlas QA contact sheet/report.

The source strips are retained under references/ and interactions/listening/; extracted transparent thinking and listening frames are under states/.

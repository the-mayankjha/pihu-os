import { lazy, Suspense } from 'react';
import { NativeVoiceOverlayWindow } from '../core/voice/NativeVoiceOverlay';
import { SpiritWindow } from '../features/spirits/Spirits';
import { NativeCommandPaletteWindow } from '../core/voice/NativeCommandPalette';

// Companion windows render only a Spirit, without mounting Pihu's voice,
// music, widgets, or startup greeting.
const App = lazy(() => import('./App'));

export default function Root() {
  const spiritId = new URLSearchParams(window.location.search).get('spirit');
  const params = new URLSearchParams(window.location.search);
  return <Suspense fallback={null}>{params.has('voiceOverlay') ? <NativeVoiceOverlayWindow /> : params.has('commandPalette') ? <NativeCommandPaletteWindow /> : spiritId ? <SpiritWindow id={spiritId} /> : <App />}</Suspense>;
}

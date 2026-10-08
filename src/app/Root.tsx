import { lazy, Suspense } from 'react';
import { NativeVoiceOverlayWindow } from '../core/voice/NativeVoiceOverlay';
import { SpiritWindow } from '../features/spirits/Spirits';

// Companion windows render only a Spirit, without mounting Pihu's voice,
// music, widgets, or startup greeting.
const App = lazy(() => import('./App'));

export default function Root() {
  const spiritId = new URLSearchParams(window.location.search).get('spirit');
  return <Suspense fallback={null}>{new URLSearchParams(window.location.search).has('voiceOverlay') ? <NativeVoiceOverlayWindow /> : spiritId ? <SpiritWindow id={spiritId} /> : <App />}</Suspense>;
}

import conversation0 from '../../../src-tauri/minis/pihu/interactions/talking/frames/00.png?url';
import conversation1 from '../../../src-tauri/minis/pihu/interactions/talking/frames/01.png?url';
import conversation2 from '../../../src-tauri/minis/pihu/interactions/talking/frames/02.png?url';
import conversation3 from '../../../src-tauri/minis/pihu/interactions/talking/frames/03.png?url';
import highFive0 from '../../../src-tauri/minis/pihu/interactions/high-five/frames/00.png?url';
import highFive1 from '../../../src-tauri/minis/pihu/interactions/high-five/frames/01.png?url';
import highFive2 from '../../../src-tauri/minis/pihu/interactions/high-five/frames/02.png?url';
import highFive3 from '../../../src-tauri/minis/pihu/interactions/high-five/frames/03.png?url';
import handshake0 from '../../../src-tauri/minis/pihu/interactions/handshake/frames/00.png?url';
import handshake1 from '../../../src-tauri/minis/pihu/interactions/handshake/frames/01.png?url';
import handshake2 from '../../../src-tauri/minis/pihu/interactions/handshake/frames/02.png?url';
import handshake3 from '../../../src-tauri/minis/pihu/interactions/handshake/frames/03.png?url';
import hug0 from '../../../src-tauri/minis/pihu/interactions/hug/frames/00.png?url';
import hug1 from '../../../src-tauri/minis/pihu/interactions/hug/frames/01.png?url';
import hug2 from '../../../src-tauri/minis/pihu/interactions/hug/frames/02.png?url';
import hug3 from '../../../src-tauri/minis/pihu/interactions/hug/frames/03.png?url';
import type { Spirit } from './model';
import type { SocialAction } from './socialModel';

const metadata = import.meta.glob('../../../src-tauri/minis/*/pet.json', { eager: true, import: 'default' }) as Record<string, Spirit>;
const sheets = import.meta.glob('../../../src-tauri/minis/*/spritesheet-extended.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const talkingFrames = import.meta.glob('../../../src-tauri/minis/pihu/final/tts-visemes/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const socialFrames: Record<SocialAction, string[]> = {
  'talking': [conversation0, conversation1, conversation2, conversation3],
  'high-five': [highFive0, highFive1, highFive2, highFive3],
  'handshake': [handshake0, handshake1, handshake2, handshake3],
  'hug': [hug0, hug1, hug2, hug3],
};
export function spiritSocialFrames(action: SocialAction): string[] { return socialFrames[action]; }

export function spiritTalkingFrames(id: string): string[] {
  return id === 'pihu' ? Object.entries(talkingFrames).filter(([path]) => !path.endsWith('-mouth.png')).sort(([a], [b]) => a.localeCompare(b)).map(([, url]) => url) : [];
}

export const bundledSpirits: Spirit[] = Object.entries(metadata).flatMap(([path, pet]) => {
  const id = path.split('/').at(-2)!;
  return sheets[path.replace('pet.json', 'spritesheet-extended.png')]
    ? [{ id, name: pet.name, description: pet.description }]
    : [];
});

export function bundledSheet(id: string) {
  return sheets[`../../../src-tauri/minis/${id}/spritesheet-extended.png`];
}

// Keep imported artwork out of localStorage (sheets can exceed its quota).
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('pihu-spirits', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('sheets');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Could not open Spirit storage.'));
  });
}

export async function saveSpiritSheet(id: string, file: Blob) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sheets', 'readwrite');
      tx.objectStore('sheets').put(file, id);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(new Error('Could not save this Spirit.'));
    });
  } finally { db.close(); }
}

export async function loadSpiritSheet(id: string): Promise<string> {
  const bundled = bundledSheet(id);
  if (bundled) return bundled;
  const db = await database();
  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      const request = db.transaction('sheets').objectStore('sheets').get(id);
      request.onsuccess = () => request.result ? resolve(request.result) : reject(new Error('Spirit artwork is missing.'));
      request.onerror = () => reject(new Error('Could not load Spirit artwork.'));
    });
    return URL.createObjectURL(blob);
  } finally { db.close(); }
}

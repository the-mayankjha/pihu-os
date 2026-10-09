import piyuHug0 from '../../../src-tauri/minis/piyu/interactions/hug/frames/00.png?url';
import piyuHug1 from '../../../src-tauri/minis/piyu/interactions/hug/frames/01.png?url';
import piyuHug2 from '../../../src-tauri/minis/piyu/interactions/hug/frames/02.png?url';
import piyuHug3 from '../../../src-tauri/minis/piyu/interactions/hug/frames/03.png?url';
import piyuHighFive0 from '../../../src-tauri/minis/piyu/interactions/high-five/frames/00.png?url';
import piyuHighFive1 from '../../../src-tauri/minis/piyu/interactions/high-five/frames/01.png?url';
import piyuHighFive2 from '../../../src-tauri/minis/piyu/interactions/high-five/frames/02.png?url';
import piyuHighFive3 from '../../../src-tauri/minis/piyu/interactions/high-five/frames/03.png?url';
import piyuHandshake0 from '../../../src-tauri/minis/piyu/interactions/handshake/frames/00.png?url';
import piyuHandshake1 from '../../../src-tauri/minis/piyu/interactions/handshake/frames/01.png?url';
import piyuHandshake2 from '../../../src-tauri/minis/piyu/interactions/handshake/frames/02.png?url';
import piyuHandshake3 from '../../../src-tauri/minis/piyu/interactions/handshake/frames/03.png?url';
import piyuTalking0 from '../../../src-tauri/minis/piyu/interactions/talking/frames/00.png?url';
import piyuTalking1 from '../../../src-tauri/minis/piyu/interactions/talking/frames/01.png?url';
import piyuTalking2 from '../../../src-tauri/minis/piyu/interactions/talking/frames/02.png?url';
import piyuTalking3 from '../../../src-tauri/minis/piyu/interactions/talking/frames/03.png?url';
import piyuLooking0 from '../../../src-tauri/minis/piyu/interactions/looking/frames/00.png?url';
import piyuLooking1 from '../../../src-tauri/minis/piyu/interactions/looking/frames/01.png?url';
import piyuLooking2 from '../../../src-tauri/minis/piyu/interactions/looking/frames/02.png?url';
import piyuLooking3 from '../../../src-tauri/minis/piyu/interactions/looking/frames/03.png?url';
import piyuCheekTouch0 from '../../../src-tauri/minis/piyu/interactions/cheek-touch/frames/00.png?url';
import piyuCheekTouch1 from '../../../src-tauri/minis/piyu/interactions/cheek-touch/frames/01.png?url';
import piyuCheekTouch2 from '../../../src-tauri/minis/piyu/interactions/cheek-touch/frames/02.png?url';
import piyuCheekTouch3 from '../../../src-tauri/minis/piyu/interactions/cheek-touch/frames/03.png?url';
import piyuLaughing0 from '../../../src-tauri/minis/piyu/interactions/laughing/frames/00.png?url';
import piyuLaughing1 from '../../../src-tauri/minis/piyu/interactions/laughing/frames/01.png?url';
import piyuLaughing2 from '../../../src-tauri/minis/piyu/interactions/laughing/frames/02.png?url';
import piyuLaughing3 from '../../../src-tauri/minis/piyu/interactions/laughing/frames/03.png?url';
import piyuSmiling0 from '../../../src-tauri/minis/piyu/interactions/smiling/frames/00.png?url';
import piyuSmiling1 from '../../../src-tauri/minis/piyu/interactions/smiling/frames/01.png?url';
import piyuSmiling2 from '../../../src-tauri/minis/piyu/interactions/smiling/frames/02.png?url';
import piyuSmiling3 from '../../../src-tauri/minis/piyu/interactions/smiling/frames/03.png?url';
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
import type { SocialAction, SocialCompanion } from './socialModel';

const metadata = import.meta.glob('../../../src-tauri/minis/*/pet.json', { eager: true, import: 'default' }) as Record<string, Spirit>;
const sheets = import.meta.glob('../../../src-tauri/minis/*/spritesheet-extended.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const talkingFrames = import.meta.glob('../../../src-tauri/minis/*/final/tts-visemes/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const socialFrames: Partial<Record<SocialAction, string[]>> = {
  'talking': [conversation0, conversation1, conversation2, conversation3],
  'high-five': [highFive0, highFive1, highFive2, highFive3],
  'handshake': [handshake0, handshake1, handshake2, handshake3],
  'hug': [hug0, hug1, hug2, hug3],
};
const piyuSocialFrames: Record<SocialAction, string[]> = {
  'hug': [piyuHug0, piyuHug1, piyuHug2, piyuHug3],
  'high-five': [piyuHighFive0, piyuHighFive1, piyuHighFive2, piyuHighFive3],
  'handshake': [piyuHandshake0, piyuHandshake1, piyuHandshake2, piyuHandshake3],
  'talking': [piyuTalking0, piyuTalking1, piyuTalking2, piyuTalking3],
  'looking': [piyuLooking0, piyuLooking1, piyuLooking2, piyuLooking3],
  'cheek-touch': [piyuCheekTouch0, piyuCheekTouch1, piyuCheekTouch2, piyuCheekTouch3],
  'laughing': [piyuLaughing0, piyuLaughing1, piyuLaughing2, piyuLaughing3],
  'smiling': [piyuSmiling0, piyuSmiling1, piyuSmiling2, piyuSmiling3],
};
export function spiritSocialFrames(action: SocialAction, companion: SocialCompanion = 'pihu'): string[] { return (companion === 'piyu' ? piyuSocialFrames : socialFrames)[action] ?? []; }

export function spiritTalkingFrames(id: string): string[] {
  return Object.entries(talkingFrames).filter(([path]) => path.includes(`/minis/${id}/`) && !path.endsWith('-mouth.png')).sort(([a], [b]) => a.localeCompare(b)).map(([, url]) => url);
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

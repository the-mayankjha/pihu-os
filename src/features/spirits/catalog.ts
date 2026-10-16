import type { Spirit } from './model';
import type { SocialAction, SocialCompanion } from './socialModel';

// Pihu is the single bundled Spirit. Other packages are fetched through PIHU
// Market and kept in IndexedDB so the Tauri companion windows can render them.
const metadata = import.meta.glob('../../../src-tauri/spirits/pihu/spirit.json', { eager: true, import: 'default' }) as Record<string, Spirit>;
const sheets = import.meta.glob('../../../src-tauri/spirits/pihu/spritesheet-extended.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const bundledAssets = {
  ...import.meta.glob('../../../src-tauri/spirits/pihu/states/**/*.png', { eager: true, query: '?url', import: 'default' }),
  ...import.meta.glob('../../../src-tauri/spirits/pihu/final/tts-visemes/*.png', { eager: true, query: '?url', import: 'default' }),
  ...import.meta.glob('../../../src-tauri/spirits/pihu/interactions/**/*.png', { eager: true, query: '?url', import: 'default' }),
} as Record<string, string>;

const packageKey = (id: string, path: string) => `${id}::${path}`;
const storedAssetUrls = new Map<string, string>();

export const bundledSpirits: Spirit[] = Object.entries(metadata).map(([, spirit]) => ({
  id: 'pihu', name: spirit.name, description: spirit.description, version: '1.0.0', author: 'Mayank Jha (PIHU)',
}));

export function bundledSheet(id: string) {
  return id === 'pihu' ? sheets['../../../src-tauri/spirits/pihu/spritesheet-extended.png'] : undefined;
}

function bundledAsset(id: string, path: string): string | undefined {
  if (id !== 'pihu') return undefined;
  return bundledAssets[`../../../src-tauri/spirits/pihu/${path}`];
}

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('pihu-spirits', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('sheets');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Could not open Spirit storage.'));
  });
}

async function readStoredAsset(id: string, path: string): Promise<Blob | undefined> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('sheets').objectStore('sheets').get(packageKey(id, path));
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : undefined);
      request.onerror = () => reject(new Error('Could not load Spirit artwork.'));
    });
  } finally { db.close(); }
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

export async function saveSpiritPackage(id: string, assets: Map<string, Blob>) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sheets', 'readwrite');
      const store = tx.objectStore('sheets');
      const request = store.getAllKeys();
      request.onsuccess = () => {
        for (const key of request.result) {
          if (String(key).startsWith(`${id}::`)) store.delete(key);
        }
        for (const [path, blob] of assets) store.put(blob, packageKey(id, path));
        const sheet = assets.get('spritesheet-extended.png');
        if (sheet) store.put(sheet, id);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(new Error('Could not save the Spirit package.'));
    });
  } finally { db.close(); }
  for (const [key, url] of storedAssetUrls) {
    if (key.startsWith(`${id}::`)) {
      URL.revokeObjectURL(url);
      storedAssetUrls.delete(key);
    }
  }
}

export async function deleteSpiritPackage(id: string) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sheets', 'readwrite');
      const store = tx.objectStore('sheets');
      const request = store.getAllKeys();
      request.onsuccess = () => {
        for (const key of request.result) {
          if (key === id || String(key).startsWith(`${id}::`)) store.delete(key);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(new Error('Could not remove the Spirit package.'));
    });
  } finally { db.close(); }
  for (const [key, url] of storedAssetUrls) {
    if (key.startsWith(`${id}::`)) {
      URL.revokeObjectURL(url);
      storedAssetUrls.delete(key);
    }
  }
}

export async function loadSpiritSheet(id: string): Promise<string> {
  const blob = await readStoredAsset(id, 'spritesheet-extended.png') ?? await (async () => {
      const db = await database();
      try {
        return await new Promise<Blob | undefined>((resolve, reject) => {
          const request = db.transaction('sheets').objectStore('sheets').get(id);
          request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : undefined);
          request.onerror = () => reject(new Error('Could not load Spirit artwork.'));
        });
      } finally { db.close(); }
    })();
  if (!blob) {
    const bundled = bundledSheet(id);
    if (bundled) return bundled;
    throw new Error('Spirit artwork is missing.');
  }
  return URL.createObjectURL(blob);
}

export async function loadSpiritAsset(id: string, path: string): Promise<string | undefined> {
  const key = packageKey(id, path);
  const cached = storedAssetUrls.get(key);
  if (cached) return cached;
  const blob = await readStoredAsset(id, path);
  if (!blob) return bundledAsset(id, path);
  const url = URL.createObjectURL(blob);
  storedAssetUrls.set(key, url);
  return url;
}

async function loadSpiritAssets(id: string, prefix: string): Promise<string[]> {
  const db = await database();
  try {
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const request = db.transaction('sheets').objectStore('sheets').getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Could not inspect Spirit artwork.'));
    });
    const paths = keys.map(String).filter(key => key.startsWith(`${id}::${prefix}`)).map(key => key.slice(id.length + 2)).sort();
    if (!paths.length && id === 'pihu') return Object.entries(bundledAssets)
      .filter(([path]) => path.startsWith(`../../../src-tauri/spirits/pihu/${prefix}`))
      .sort(([a], [b]) => a.localeCompare(b)).map(([, url]) => url);
    return (await Promise.all(paths.map(path => loadSpiritAsset(id, path))))
      .filter((url): url is string => Boolean(url));
  } finally { db.close(); }
}

export async function spiritSocialFrames(action: SocialAction, companion: SocialCompanion = 'pihu'): Promise<string[]> {
  const id = companion;
  return loadSpiritAssets(id, `interactions/${action}/frames/`);
}

export async function spiritSpecialFrames(id: string, action: SocialAction): Promise<string[]> {
  return loadSpiritAssets(id, `interactions/${action}/frames/`);
}

export async function spiritListeningStateStrip(id: string): Promise<string | undefined> {
  return loadSpiritAsset(id, 'states/listening.png');
}

export async function spiritThinkingStrip(id: string): Promise<string | undefined> {
  return loadSpiritAsset(id, 'states/thinking.png');
}

export async function spiritTalkingFrames(id: string): Promise<string[]> {
  return loadSpiritAssets(id, 'final/tts-visemes/').then(urls => urls.filter(url => !url.toLowerCase().includes('-mouth.png')));
}

export async function spiritListeningFrames(id: string): Promise<string[]> {
  return loadSpiritAssets(id, 'interactions/listening/strips/');
}

import type { Spirit } from './model';

const metadata = import.meta.glob('../../../src-tauri/minis/*/pet.json', { eager: true, import: 'default' }) as Record<string, Spirit>;
const sheets = import.meta.glob('../../../src-tauri/minis/*/spritesheet-extended.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

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

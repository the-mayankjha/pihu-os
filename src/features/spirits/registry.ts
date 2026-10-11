import { validateSheetDimensions, validateSheetPixels } from './model';

const REGISTRY_URL = import.meta.env.VITE_SPIRITS_REGISTRY_URL
  || 'https://raw.githubusercontent.com/the-mayankjha/pihu_spirits/pihu_market/index.json';
const MAX_INDEX_BYTES = 1024 * 1024;
const MAX_SPRITE_BYTES = 20 * 1024 * 1024;

export interface RegistrySpirit {
  id: string;
  name: string;
  description: string;
  version: string;
  manifest: string;
  sprite_sheet: string;
  sha256: string;
  size_bytes: number;
}

interface RegistryIndex {
  schema_version: 1;
  package_type: 'spirits';
  packages: RegistrySpirit[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

function safeRelativePath(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256
    && !value.startsWith('/') && !value.includes('..') && !value.includes('\\');
}

function parseIndex(value: unknown): RegistryIndex {
  if (!isRecord(value) || value.schema_version !== 1 || value.package_type !== 'spirits' || !Array.isArray(value.packages)) {
    throw new Error('The Spirits registry returned an unsupported catalog.');
  }
  const seen = new Set<string>();
  const packages = value.packages.map((item): RegistrySpirit => {
    if (!isRecord(item)
      || typeof item.id !== 'string' || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(item.id)
      || typeof item.name !== 'string' || item.name.length > 128
      || typeof item.description !== 'string' || item.description.length > 1000
      || typeof item.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(item.version)
      || !safeRelativePath(item.manifest) || !safeRelativePath(item.sprite_sheet)
      || typeof item.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(item.sha256)
      || !Number.isSafeInteger(item.size_bytes) || (item.size_bytes as number) < 1 || (item.size_bytes as number) > MAX_SPRITE_BYTES) {
      throw new Error('The Spirits registry contains an invalid package entry.');
    }
    if (seen.has(item.id)) throw new Error('The Spirits registry contains a duplicate package ID.');
    seen.add(item.id);
    return item as unknown as RegistrySpirit;
  });
  return { schema_version: 1, package_type: 'spirits', packages };
}

function registryResource(path: string) {
  const base = new URL(REGISTRY_URL);
  const resource = new URL(path, base);
  if (resource.origin !== base.origin || !resource.pathname.startsWith(base.pathname.replace(/[^/]*$/, ''))) {
    throw new Error('The package points outside the configured Spirits registry.');
  }
  return resource;
}

export async function loadSpiritRegistry(): Promise<RegistrySpirit[]> {
  const response = await fetch(REGISTRY_URL, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Could not load the Spirits registry (${response.status}).`);
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > MAX_INDEX_BYTES) throw new Error('The Spirits registry catalog is too large.');
  return parseIndex(await response.json()).packages;
}

async function validateSpriteSheet(blob: Blob) {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    validateSheetDimensions(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Could not inspect the Spirit artwork.');
    context.drawImage(image, 0, 0);
    validateSheetPixels(canvas.width, canvas.height, context.getImageData(0, 0, canvas.width, canvas.height).data);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function downloadSpirit(entry: RegistrySpirit): Promise<Blob> {
  const manifestResponse = await fetch(registryResource(entry.manifest));
  if (!manifestResponse.ok) throw new Error('Could not load the Spirit package manifest.');
  const manifest = await manifestResponse.json() as Record<string, unknown>;
  const assets = isRecord(manifest.assets) ? manifest.assets : null;
  if (manifest.schema_version !== 1 || manifest.type !== 'spirits' || manifest.id !== entry.id
    || manifest.version !== entry.version || assets?.sprite_sheet !== entry.sprite_sheet) {
    throw new Error('The Spirit manifest does not match the catalog entry.');
  }

  const response = await fetch(registryResource(entry.sprite_sheet));
  if (!response.ok) throw new Error(`Could not download ${entry.name}'s artwork.`);
  const blob = await response.blob();
  if (blob.size !== entry.size_bytes || blob.size > MAX_SPRITE_BYTES) throw new Error('The downloaded Spirit artwork has an unexpected size.');
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  if (sha256 !== entry.sha256.toLowerCase()) throw new Error('The downloaded Spirit artwork failed its SHA-256 check.');
  await validateSpriteSheet(blob);
  return blob;
}

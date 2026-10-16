import { validateSheetDimensions, validateSheetPixels } from './model';

const MARKET_API_URL = (import.meta.env.VITE_PIHU_MARKET_API_URL || 'https://pihu.nfks.co.in/api/v2').replace(/\/$/, '');
const MAX_INDEX_BYTES = 1024 * 1024;
const MAX_ASSET_BYTES = 20 * 1024 * 1024;
const MAX_PACKAGE_BYTES = 80 * 1024 * 1024;
const MAX_PACKAGE_FILES = 256;

export interface SpiritAsset {
  path: string;
  sha256: string;
  size_bytes: number;
  url: string;
}

export interface RegistrySpirit {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  manifest: Record<string, unknown>;
  sprite_sheet: string;
  preview_url: string;
  sha256: string;
  size_bytes: number;
  files: SpiritAsset[];
}

export interface SpiritDetails {
  package: Record<string, unknown>;
  manifest: Record<string, unknown>;
  animation: {
    cell?: { width: number; height: number };
    sheet?: { width: number; heights: number[] };
    animations?: Array<{ id: string; label: string; row: number; frames: number; fps: number }>;
    special_poses?: Array<{ id: string; source?: string; row: number; frames: number; fps: number; assets?: string }>;
    state_mapping?: Record<string, string>;
    activity_rules?: Array<{ when: string; animation: string }>;
    idle_rules?: Array<Record<string, string | number>>;
    interactions?: string[];
    social_timing_ms?: Record<string, number>;
  };
  assets: SpiritAsset[];
  preview_url: string;
  download_url: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function safeRelativePath(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256
    && !value.startsWith('/') && !value.includes('..') && !value.includes('\\');
}

function assetFrom(value: unknown, apiOrigin: string): SpiritAsset | null {
  if (!isRecord(value) || !safeRelativePath(value.path)
    || typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(value.sha256)
    || !Number.isSafeInteger(value.size_bytes) || (value.size_bytes as number) < 1 || (value.size_bytes as number) > MAX_ASSET_BYTES
    || typeof value.url !== 'string') return null;
  try {
    const url = new URL(value.url);
    if (url.origin !== apiOrigin || !url.pathname.startsWith('/api/v2/packages/')) return null;
    return { path: value.path, sha256: value.sha256, size_bytes: value.size_bytes as number, url: url.toString() };
  } catch { return null; }
}

async function fetchJSON(url: string, label: string) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${label} (${response.status}).`);
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > MAX_INDEX_BYTES) throw new Error('The Spirits Market response is too large.');
  return response.json() as Promise<unknown>;
}

export async function loadSpiritRegistry(): Promise<RegistrySpirit[]> {
  const apiOrigin = new URL(MARKET_API_URL).origin;
  const catalog = await fetchJSON(`${MARKET_API_URL}/catalog?type=spirits&limit=100`, 'Could not load the Spirits catalog');
  if (!isRecord(catalog) || !Array.isArray(catalog.packages)) throw new Error('The PIHU Market API returned an invalid Spirits catalog.');
  const entries = catalog.packages.filter((item): item is Record<string, unknown> =>
    isRecord(item) && item.type === 'spirits' && typeof item.id === 'string'
      && /^[a-z0-9][a-z0-9-]{1,63}$/.test(item.id));

  return Promise.all(entries.map(async item => {
    const details = await fetchJSON(`${MARKET_API_URL}/packages/${encodeURIComponent(item.id as string)}/details`, `Could not load details for ${String(item.display_name ?? item.name)}`);
    if (!isRecord(details) || !isRecord(details.manifest) || !isRecord(details.manifest.assets) || !Array.isArray(details.assets)) {
      throw new Error(`The PIHU Market API returned invalid package details for ${String(item.id)}.`);
    }
    const manifest = details.manifest;
    const manifestAssets = isRecord(manifest.assets) ? manifest.assets : null;
    const detailAssets = details.assets;
    if (!manifestAssets) throw new Error(`The PIHU Market API returned invalid package details for ${String(item.id)}.`);
    const packageInfo = isRecord(details.package) ? details.package : item;
    const files = detailAssets.map(file => assetFrom(file, apiOrigin)).filter((file): file is SpiritAsset => file !== null);
    const spriteSheet = manifestAssets.sprite_sheet;
    const sheet = files.find(file => file.path === spriteSheet);
    const entry: RegistrySpirit = {
      id: String(packageInfo.id ?? item.id),
      name: String(packageInfo.display_name ?? packageInfo.name ?? item.display_name ?? item.name),
      description: String(packageInfo.description ?? item.description ?? ''),
      author: String(packageInfo.author ?? item.author ?? 'Unknown author'),
      version: String(packageInfo.version ?? item.version ?? ''),
      manifest,
      sprite_sheet: String(spriteSheet ?? ''),
      preview_url: String(details.preview_url ?? packageInfo.preview_url ?? ''),
      sha256: sheet?.sha256 ?? String(packageInfo.sha256 ?? ''),
      size_bytes: sheet?.size_bytes ?? Number(packageInfo.size_bytes ?? 0),
      files,
    };
    if (manifest.schema_version !== 1 || manifest.type !== 'spirits' || manifest.id !== entry.id
      || manifest.version !== entry.version || !sheet || files.length !== detailAssets.length
      || files.length > MAX_PACKAGE_FILES || files.reduce((sum, file) => sum + file.size_bytes, 0) > MAX_PACKAGE_BYTES) {
      throw new Error(`The PIHU Market API returned incomplete or unsafe Spirit package data for ${entry.id}.`);
    }
    return entry;
  }));
}

export async function loadSpiritDetails(id: string): Promise<SpiritDetails> {
  const details = await fetchJSON(`${MARKET_API_URL}/packages/${encodeURIComponent(id)}/details`, 'Could not load Spirit details');
  if (!isRecord(details) || !isRecord(details.manifest) || !isRecord(details.animation)
    || !Array.isArray(details.animation.animations) || !isRecord(details.animation.state_mapping)
    || !Array.isArray(details.assets) || typeof details.preview_url !== 'string' || typeof details.download_url !== 'string') {
    throw new Error('The PIHU Market API returned incomplete Spirit details.');
  }
  return details as unknown as SpiritDetails;
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
  } finally { URL.revokeObjectURL(url); }
}

async function checkedAsset(file: SpiritAsset): Promise<Blob> {
  const response = await fetch(file.url, { headers: { Accept: 'image/png' } });
  if (!response.ok) throw new Error(`Could not download Spirit asset ${file.path} (${response.status}).`);
  const blob = await response.blob();
  if (blob.size !== file.size_bytes || blob.size > MAX_ASSET_BYTES) throw new Error(`Spirit asset ${file.path} has an unexpected size.`);
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  if (sha256 !== file.sha256.toLowerCase()) throw new Error(`Spirit asset ${file.path} failed its SHA-256 check.`);
  return blob;
}

export async function downloadSpirit(entry: RegistrySpirit): Promise<Map<string, Blob>> {
  const manifest = entry.manifest;
  const assets = isRecord(manifest.assets) ? manifest.assets : null;
  if (manifest.schema_version !== 1 || manifest.type !== 'spirits' || manifest.id !== entry.id
    || manifest.version !== entry.version || assets?.sprite_sheet !== entry.sprite_sheet
    || entry.files.length === 0 || entry.files.length > MAX_PACKAGE_FILES
    || entry.files.reduce((sum, file) => sum + file.size_bytes, 0) > MAX_PACKAGE_BYTES) {
    throw new Error('The Spirit manifest does not match the catalog entry.');
  }

  // Keep downloads bounded; packages may include many individual animation
  // frames, and this runs inside the desktop renderer.
  const downloaded = new Map<string, Blob>();
  let cursor = 0;
  const workers = Array.from({ length: Math.min(4, entry.files.length) }, async () => {
    while (cursor < entry.files.length) {
      const file = entry.files[cursor++];
      if (!safeRelativePath(file.path) || !file.path.toLowerCase().endsWith('.png')) {
        throw new Error(`The Spirit catalog contains an invalid asset path for ${entry.id}.`);
      }
      downloaded.set(file.path, await checkedAsset(file));
    }
  });
  await Promise.all(workers);
  const sheet = downloaded.get(entry.sprite_sheet);
  if (!sheet || sheet.size !== entry.size_bytes) throw new Error('The Spirit package is missing its declared sprite sheet.');
  await validateSpriteSheet(sheet);
  return downloaded;
}

import { validateSheetDimensions, validateSheetPixels } from './model';

const REGISTRY_URL = import.meta.env.VITE_SPIRITS_REGISTRY_URL
  || 'https://raw.githubusercontent.com/the-mayankjha/pihu_spirits/pihu_market/index.json';
const MARKET_API_URL = import.meta.env.VITE_PIHU_MARKET_API_URL || 'https://pihu.nfks.co.in/api/v2';
const MAX_INDEX_BYTES = 1024 * 1024;
const MAX_SPRITE_BYTES = 20 * 1024 * 1024;

export interface RegistrySpirit {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  manifest: string;
  sprite_sheet: string;
  preview_url: string;
  sha256: string;
  size_bytes: number;
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
  assets: Array<{ path: string; sha256: string; size_bytes: number; url: string }>;
  preview_url: string;
  download_url: string;
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
  const registryResponse = await fetch(REGISTRY_URL, { headers: { Accept: 'application/json' } });
  if (!registryResponse.ok) throw new Error(`Could not load the Spirits registry (${registryResponse.status}).`);
  const length = Number(registryResponse.headers.get('content-length') ?? 0);
  if (length > MAX_INDEX_BYTES) throw new Error('The Spirits registry catalog is too large.');
  const registry = parseIndex(await registryResponse.json()).packages;
  const apiOrigin = new URL(MARKET_API_URL).origin;
  const previews = new Map<string, { author: string; preview_url: string }>();

  // The registry is the source of truth for what can be installed. The Market
  // API enriches it with preview URLs, but a not-yet-deployed API route should
  // not make the entire Spirits catalog disappear from the desktop app.
  try {
    const marketResponse = await fetch(`${MARKET_API_URL}/catalog?type=spirits&limit=100`, { headers: { Accept: 'application/json' } });
    if (marketResponse.ok) {
      const market = await marketResponse.json() as { packages?: Array<Record<string, unknown>> };
      for (const item of market.packages ?? []) {
        if (typeof item.id !== 'string' || typeof item.preview_url !== 'string' || typeof item.author !== 'string') continue;
        const preview = new URL(item.preview_url);
        if (preview.origin === apiOrigin && preview.pathname.startsWith('/api/v2/packages/')) {
          previews.set(item.id, { author: item.author, preview_url: preview.toString() });
        }
      }
    }
  } catch {
    // Use the package manifests below as metadata fallback when the API is offline.
  }

  return Promise.all(registry.map(async entry => {
    const apiPreview = new URL(`/api/v2/packages/${encodeURIComponent(entry.id)}/preview`, apiOrigin).toString();
    const marketEntry = previews.get(entry.id);
    if (marketEntry) return { ...entry, ...marketEntry };

    let author = 'Unknown author';
    try {
      const response = await fetch(registryResource(entry.manifest), { headers: { Accept: 'application/json' } });
      if (response.ok) {
        const manifest = await response.json() as Record<string, unknown>;
        if (typeof manifest.author === 'string' && manifest.author.trim()) author = manifest.author;
      }
    } catch {
      // A missing optional author field should not hide an installable Spirit.
    }
    return { ...entry, author, preview_url: apiPreview };
  }));
}

export async function loadSpiritDetails(id: string): Promise<SpiritDetails> {
  const response = await fetch(`${MARKET_API_URL}/packages/${encodeURIComponent(id)}/details`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Could not load Spirit details from the PIHU Market API (${response.status}).`);
  const details = await response.json() as SpiritDetails;
  if (!details || typeof details !== 'object' || typeof details.manifest !== 'object' || !Array.isArray(details.animation?.animations)
    || !details.animation.state_mapping || !Array.isArray(details.assets)) {
    throw new Error('The PIHU Market API returned incomplete Spirit details.');
  }
  return details;
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

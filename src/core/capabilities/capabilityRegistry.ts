import type { PihuCapability, CapabilityMatch } from './types';

export class CapabilityRegistry {
  private static instance: CapabilityRegistry;
  private capabilities = new Map<string, PihuCapability>();

  public static getInstance(): CapabilityRegistry {
    if (!CapabilityRegistry.instance) {
      CapabilityRegistry.instance = new CapabilityRegistry();
    }
    return CapabilityRegistry.instance;
  }

  public register(capability: PihuCapability): void {
    this.capabilities.set(capability.manifest.id, capability);
    console.log(`[CapabilityRegistry] Registered capability: ${capability.manifest.name} (${capability.manifest.id})`);
  }

  public get(id: string): PihuCapability | undefined {
    return this.capabilities.get(id);
  }

  public getAll(): PihuCapability[] {
    return Array.from(this.capabilities.values());
  }

  /**
   * Resolves the most suitable capability for the incoming user request.
   */
  public async resolve(request: { prompt: string; context?: any }): Promise<{ capability: PihuCapability; match: CapabilityMatch } | null> {
    let bestMatch: { capability: PihuCapability; match: CapabilityMatch } | null = null;
    let highestConfidence = 0;

    for (const capability of this.capabilities.values()) {
      try {
        const match = await capability.canHandle(request);
        if (match.matched && match.confidence > highestConfidence) {
          highestConfidence = match.confidence;
          bestMatch = { capability, match };
        }
      } catch (err) {
        console.warn(`[CapabilityRegistry] Error checking capability ${capability.manifest.id}:`, err);
      }
    }

    return bestMatch;
  }
}

export const capabilityRegistry = CapabilityRegistry.getInstance();

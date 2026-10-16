import type { RepositoryInput, RepositoryContext, RepositoryAdapter } from './types';
import { LocalRepositoryAdapter } from './local-adapter';
import { RemoteRepositoryAdapter } from './remote-adapter';

export class RepositoryResolver {
  private static adapters: RepositoryAdapter[] = [
    new RemoteRepositoryAdapter(),
    new LocalRepositoryAdapter(),
  ];

  /**
   * Resolves a RepositoryInput into an active RepositoryContext using the best adapter.
   */
  public static async resolve(input: RepositoryInput): Promise<RepositoryContext> {
    for (const adapter of this.adapters) {
      if (await adapter.detect(input)) {
        return adapter.open(input);
      }
    }
    // Default to local adapter
    return new LocalRepositoryAdapter().open(input);
  }

  /**
   * Parses conversational repository references from natural language.
   */
  public static parseFromPrompt(prompt: string): RepositoryInput | null {
    // 1. Detect GitHub URL
    const urlMatch = prompt.match(/https:\/\/github\.com\/([a-zA-Z0-9_\-]+)\/([a-zA-Z0-9_\-]+)/);
    if (urlMatch) {
      return {
        type: 'remote',
        url: urlMatch[0],
        owner: urlMatch[1],
        repo: urlMatch[2]
      };
    }

    // 2. Detect "clone/work on owner/repo" or "repo <name>"
    const ownerRepoMatch = prompt.match(/\b(?:github\.com\/|repo\s+|repository\s+)([a-zA-Z0-9_\-]+)\/([a-zA-Z0-9_\-]+)\b/i);
    if (ownerRepoMatch) {
      return {
        type: 'remote',
        owner: ownerRepoMatch[1],
        repo: ownerRepoMatch[2]
      };
    }

    // 3. Detect explicit local folder path
    const pathMatch = prompt.match(/(?:\/Users\/[^\s"']+|\/(?:home|var|tmp|projects)\/[^\s"']+)/);
    if (pathMatch) {
      return {
        type: 'local',
        path: pathMatch[0]
      };
    }

    return null;
  }
}

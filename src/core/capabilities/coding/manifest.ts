import type { CapabilityManifest } from '../types';

export const codingCapabilityManifest: CapabilityManifest = {
  id: 'pihu.coding',
  name: 'Coding Capability',
  description: 'Understand, modify, debug, test and review software projects.',
  triggers: [
    'code', 'debug', 'refactor', 'implement', 'test', 'review',
    'fix', 'bug', 'inspect', 'compile', 'build', 'commit', 'patch'
  ],
  requiredTools: ['filesystem', 'terminal', 'git', 'code_search', 'code_patch'],
  permissions: ['workspace.read', 'workspace.write', 'process.execute', 'repository.sync'],
  supportedInputs: ['natural_language', 'local_repository', 'remote_repository', 'code_selection'],
  supportedOutputs: ['implementation', 'code_diff', 'test_report', 'execution_report']
};

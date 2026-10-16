export * from './types';
export * from './manifest';
export * from './capability';
export * from './discovery/project-scanner';
export * from './editing/patch-engine';
export * from './verification/test-runner';
export * from './planning/task-planner';
export * from './repository/git-manager';
export * from './repository/types';
export * from './repository/local-adapter';
export * from './repository/remote-adapter';
export * from './repository/repository-resolver';

import { capabilityRegistry } from '../capabilityRegistry';
import { CodingCapability } from './capability';

// Auto-register coding capability into PIHU's master registry
export const codingCapability = new CodingCapability();
capabilityRegistry.register(codingCapability);

export interface CapabilityManifest {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  requiredTools: string[];
  permissions: string[];
  supportedInputs: string[];
  supportedOutputs: string[];
}

export interface CapabilityMatch {
  matched: boolean;
  confidence: number;
  reason?: string;
  parameters?: Record<string, any>;
}

export interface CapabilityExecutionContext {
  taskId: string;
  prompt: string;
  parameters?: Record<string, any>;
  onProgress?: (event: any) => void;
  onApprovalRequest?: (approval: any) => Promise<boolean>;
}

export interface CapabilityResult {
  success: boolean;
  summary: string;
  data?: any;
  error?: string;
}

export interface PihuCapability {
  manifest: CapabilityManifest;
  canHandle(request: { prompt: string; context?: any }): Promise<CapabilityMatch>;
  execute(context: CapabilityExecutionContext): Promise<CapabilityResult>;
  cancel?(executionId: string): Promise<void>;
}

/**
 * Tool types for Gemini Function Calling API.
 * These mirror the Gemini REST API schema for tools/functionDeclarations.
 */

export interface FunctionParameter {
  type: string;
  description?: string;
  enum?: string[];
  items?: { type: string };
}

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters?: {
    type: 'OBJECT';
    properties: Record<string, FunctionParameter>;
    required?: string[];
  };
}

export interface GeminiTool {
  functionDeclarations: FunctionDeclaration[];
}

export interface ToolCall {
  name: string;
  args: Record<string, any>;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface ActionTool {
  declaration: FunctionDeclaration;
  execute: (args: Record<string, any>) => Promise<ToolResult> | ToolResult;
}

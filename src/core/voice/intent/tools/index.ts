import { musicTools } from './musicTools';
import { widgetTools } from './widgetTools';
import { todoTools } from './todoTools';
import { systemTools } from './systemTools';
import type { ActionTool, GeminiTool, ToolResult } from './types';

// ─── Master Tool Registry ─────────────────────────────────────────────────────

/** All tools available to the Intent Engine, grouped by domain. */
export const ALL_TOOLS: ActionTool[] = [
  ...musicTools,
  ...widgetTools,
  ...todoTools,
  ...systemTools,
];

/** Executor map: tool name → executor function */
const EXECUTOR_MAP = new Map<string, ActionTool['execute']>(
  ALL_TOOLS.map(t => [t.declaration.name, t.execute])
);

/**
 * Builds the Gemini-compatible tools array from all registered tools.
 * Pass this to the Gemini API as the `tools` field.
 */
export function buildGeminiTools(): GeminiTool[] {
  return [{
    functionDeclarations: ALL_TOOLS.map(t => t.declaration),
  }];
}

/**
 * Executes a tool by name with the given args.
 * Returns a ToolResult with success/error info.
 */
export async function executeTool(name: string, args: Record<string, any>): Promise<ToolResult> {
  const executor = EXECUTOR_MAP.get(name);
  if (!executor) {
    console.error(`[ToolRegistry] Unknown tool: "${name}"`);
    return { success: false, error: `Unknown tool: "${name}"` };
  }
  try {
    console.log(`[ToolRegistry] Executing tool: ${name}`, args);
    return await executor(args);
  } catch (e: any) {
    console.error(`[ToolRegistry] Tool "${name}" threw an error:`, e);
    return { success: false, error: e?.message ?? String(e) };
  }
}

export type { ActionTool, GeminiTool, ToolResult };

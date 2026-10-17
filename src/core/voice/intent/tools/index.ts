import { spotifyTools } from './spotifyTools';
import { spiritTools } from './spiritTools';
import { vtopTools } from './vtopTools';
import { musicTools } from './musicTools';
import { widgetTools } from './widgetTools';
import { todoTools } from './todoTools';
import { systemTools } from './systemTools';
import { fileMcpTools } from './fileMcpTools';
import { googleWorkspaceTools } from './googleWorkspaceTools';
import { whatsappTools } from './whatsappTools';
import { projectTools } from './projectTools';
import { memplaceTools } from './memplaceTools';
import { browserTools } from './browserTools';
import { sequenceTools } from './sequenceTools';
import { uiTools } from './uiTools';
import { appTools } from './appTools';
import type { ActionTool, GeminiTool, ToolResult } from './types';
import { invoke } from '@tauri-apps/api/core';

// ─── Master Tool Registry ─────────────────────────────────────────────────────

/** All tools available to the Intent Engine, grouped by domain. */
export const ALL_TOOLS: ActionTool[] = [
  ...vtopTools,
  ...musicTools,
  ...spotifyTools,
  ...widgetTools,
  ...todoTools,
  ...systemTools,
  ...spiritTools,
  ...fileMcpTools,
  ...googleWorkspaceTools,
  ...whatsappTools,
  ...projectTools,
  ...memplaceTools,
  ...appTools,
  ...uiTools,
  ...sequenceTools,
  ...browserTools,
];


/** Executor map: tool name → executor function */
const EXECUTOR_MAP = new Map<string, ActionTool['execute']>(
  ALL_TOOLS.map(t => [t.declaration.name, t.execute])
);

/** Fetch schemas from active stdio MCP servers and expose them to voice tool calling. */
export async function loadInstalledMcpTools(): Promise<ActionTool[]> {
  try {
    const tools = await invoke<Array<{ server: string; name: string; description?: string; inputSchema?: any }>>('mcp_list_tools');
    const toGeminiSchema = (schema: any): any => {
      if (!schema || typeof schema !== 'object') return { type: 'OBJECT', properties: {} };
      const normalized = { ...schema };
      if (typeof normalized.type === 'string') normalized.type = normalized.type.toUpperCase();
      if (normalized.properties && typeof normalized.properties === 'object') {
        normalized.properties = Object.fromEntries(Object.entries(normalized.properties).map(([key, value]) => [key, toGeminiSchema(value)]));
      }
      if (normalized.items) normalized.items = toGeminiSchema(normalized.items);
      return normalized;
    };
    return tools.map(tool => {
      const name = `installed_${tool.server.replace(/[^a-zA-Z0-9_]/g, '_')}_${tool.name.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      return {
        declaration: { name, description: `[${tool.server}] ${tool.description || tool.name}`, parameters: toGeminiSchema(tool.inputSchema) },
        execute: async (args: Record<string, any>) => {
          const serverName = tool.server.toLowerCase().replaceAll('_', '-');
          const browserTask = serverName.includes('playwright') ? 'playwright'
            : serverName.includes('web-search') ? 'web-search' : null;
          const callId = browserTask ? crypto.randomUUID() : undefined;
          if (browserTask && callId) {
            try {
              const { emit } = await import('@tauri-apps/api/event');
              await emit('pihu-spirit-browser-task', { callId, kind: browserTask, active: true });
            } catch (error) { console.debug('[Spirit] Could not start browser animation:', error); }
          }
          try {
            const data = await invoke<string>('mcp_call_tool', { serverId: tool.server, toolName: tool.name, arguments: args });
            return { success: true, data };
          } catch (error) { return { success: false, error: String(error) }; }
          finally {
            if (browserTask && callId) {
              try {
                const { emit } = await import('@tauri-apps/api/event');
                await emit('pihu-spirit-browser-task', { callId, kind: browserTask, active: false });
              } catch (error) { console.debug('[Spirit] Could not stop browser animation:', error); }
            }
          }
        },
      };
    });
  } catch (error) {
    console.warn('[ToolRegistry] Could not load installed MCP tools:', error);
    return [];
  }
}

/**
 * Builds the Gemini-compatible tools array from all registered tools.
 * Pass this to the Gemini API as the `tools` field.
 */
export function buildGeminiTools(extraTools: ActionTool[] = []): GeminiTool[] {
  for (const tool of extraTools) EXECUTOR_MAP.set(tool.declaration.name, tool.execute);
  return [{
    functionDeclarations: [...ALL_TOOLS, ...extraTools].map(t => t.declaration),
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

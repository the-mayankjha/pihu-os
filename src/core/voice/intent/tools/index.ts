import { workflowTools } from './workflowTools';
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
  ...workflowTools,
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
const DECLARATION_MAP = new Map(ALL_TOOLS.map(tool => [tool.declaration.name, tool.declaration]));
const EXECUTOR_MAP = new Map<string, ActionTool['execute']>(
  ALL_TOOLS.map(t => [t.declaration.name, t.execute])
);

/** Fetch schemas from active stdio MCP servers and expose them to voice tool calling. */
export async function loadInstalledMcpTools(): Promise<ActionTool[]> {
  try {
    const tools = await invoke<Array<{ server: string; name: string; description?: string; inputSchema?: any }>>('mcp_list_tools');
    const toGeminiSchema = (schema: any, root = schema, depth = 0): any => {
      if (depth > 16) throw new Error('MCP parameter schema is too deeply nested');
      if (!schema || typeof schema !== 'object') return { type: 'OBJECT', properties: {} };
      if (schema.$ref) {
        if (!schema.$ref.startsWith('#/')) throw new Error('External parameter references are unsupported');
        const target = schema.$ref.slice(2).split('/').reduce((value: any, key: string) => value?.[key.replaceAll('~1', '/').replaceAll('~0', '~')], root);
        if (!target) throw new Error('Unresolved MCP parameter reference');
        return toGeminiSchema(target, root, depth + 1);
      }
      const variants = schema.anyOf || schema.oneOf;
      if (variants) {
        const values = variants.filter((item: any) => item.type !== 'null');
        const nullable = values.length !== variants.length;
        if (values.length === 1) return { ...toGeminiSchema(values[0], root, depth + 1), ...(nullable ? { nullable: true } : {}), ...(schema.description ? {description: schema.description} : {}) };
        return { anyOf: values.map((item: any) => toGeminiSchema(item, root, depth + 1)), ...(nullable ? {nullable: true} : {}) };
      }
      const types = Array.isArray(schema.type) ? schema.type.filter((value: string) => value !== 'null') : [schema.type];
      const type = String(types[0] || (schema.properties ? 'object' : 'string')).toUpperCase();
      const normalized: any = {type};
      if (schema.description) normalized.description = schema.description;
      if (schema.nullable || (Array.isArray(schema.type) && schema.type.includes('null'))) normalized.nullable = true;
      if (schema.enum) normalized.enum = schema.enum;
      if (type === 'OBJECT') {
        normalized.properties = Object.fromEntries(Object.entries(schema.properties || {}).map(([key, value]) => [key, toGeminiSchema(value, root, depth + 1)]));
        if (schema.required?.length) normalized.required = schema.required;
      }
      if (type === 'ARRAY') normalized.items = toGeminiSchema(schema.items || {}, root, depth + 1);
      return normalized;
    };
    return tools.filter(tool => !(tool.server.replaceAll('_', '-').includes('google') && tool.name === 'docs_create')).flatMap(tool => {
      try {
      const name = `installed_${tool.server.replace(/[^a-zA-Z0-9_]/g, '_')}_${tool.name.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      return [{
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
            try {
              const parsed = JSON.parse(data);
              if (parsed && (parsed.error || parsed.status === 'error')) return { success: false, error: String(parsed.error || parsed.message || 'MCP action failed'), data: parsed };
            } catch { /* Some MCP tools return plain text. */ }
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
      }];
      } catch (error) { console.warn(`[ToolRegistry] Skipping invalid schema for ${tool.server}/${tool.name}:`, error); return []; }
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
  for (const tool of extraTools) { EXECUTOR_MAP.set(tool.declaration.name, tool.execute); DECLARATION_MAP.set(tool.declaration.name, tool.declaration); }
  return [{
    functionDeclarations: [...ALL_TOOLS, ...extraTools].map(t => t.declaration),
  }];
}

/**
 * Executes a tool by name with the given args.
 * Returns a ToolResult with success/error info.
 */
function validateArguments(value: unknown, schema: any, path = 'arguments'): string | null {
  if (!schema || (value === null && schema.nullable)) return null;
  const type = String(schema.type || '').toUpperCase();
  if (type === 'OBJECT') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return `${path} must be an object`;
    const object = value as Record<string, unknown>;
    for (const key of schema.required || []) if (object[key] === undefined || object[key] === null) return `${path}.${key} is required`;
    for (const [key, item] of Object.entries(object)) {
      const error = validateArguments(item, schema.properties?.[key], `${path}.${key}`);
      if (error) return error;
    }
  } else if (type === 'ARRAY') {
    if (!Array.isArray(value)) return `${path} must be an array`;
    for (const item of value) { const error = validateArguments(item, schema.items, path); if (error) return error; }
  } else if (type === 'STRING' && typeof value !== 'string') return `${path} must be text`;
  else if (type === 'BOOLEAN' && typeof value !== 'boolean') return `${path} must be a boolean`;
  else if ((type === 'NUMBER' || type === 'INTEGER') && (typeof value !== 'number' || !Number.isFinite(value) || (type === 'INTEGER' && !Number.isInteger(value)))) return `${path} must be a valid ${type.toLowerCase()}`;
  if (schema.enum && !schema.enum.includes(value)) return `${path} must be one of: ${schema.enum.join(', ')}`;
  return null;
}

export async function executeTool(name: string, args: Record<string, any>, signal?: AbortSignal): Promise<ToolResult> {
  const executor = EXECUTOR_MAP.get(name);
  if (!executor) {
    console.error(`[ToolRegistry] Unknown tool: "${name}"`);
    return { success: false, error: `Unknown tool: "${name}"` };
  }
  const validationError = validateArguments(args, DECLARATION_MAP.get(name)?.parameters);
  if (validationError) return { success: false, error: validationError };
  try {
    console.log(`[ToolRegistry] Executing tool: ${name}`, args);
    signal?.throwIfAborted();
    return await executor(args, { signal });
  } catch (e: any) {
    console.error(`[ToolRegistry] Tool "${name}" threw an error:`, e);
    return { success: false, error: e?.message ?? String(e) };
  }
}

export type { ActionTool, GeminiTool, ToolResult };

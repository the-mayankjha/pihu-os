import catalog from '../../../services/spotifyToolCatalog.json';
import { callSpotifyTool } from '../../../services/spotify';
import type { ActionTool, FunctionParameter } from './types';
function parameter(schema: any): FunctionParameter {
  if (schema.anyOf) schema = { ...schema.anyOf.find((item: any) => item.type !== 'null'), description: schema.description };
  const type = Array.isArray(schema.type) ? schema.type.find((t: string) => t !== 'null') : schema.type || 'string';
  const result: FunctionParameter = { type: type.toUpperCase(), description: schema.description };
  if (schema.enum) result.enum = schema.enum.filter((v: unknown) => typeof v === 'string');
  if (schema.items) result.items = parameter(schema.items);
  if (schema.properties) result.properties = Object.fromEntries(Object.entries(schema.properties).map(([key,value])=>[key,parameter(value)]));
  if (schema.required) result.required = schema.required;
  return result;
}
export const spotifyTools: ActionTool[] = catalog.map(tool => ({
  declaration: { name: `spotify_${tool.name}`, description: `Spotify: ${tool.description}`, parameters: { type: 'OBJECT', properties: Object.fromEntries(Object.entries(tool.inputSchema.properties || {}).map(([key,value])=>[key,parameter(value)])), required: 'required' in tool.inputSchema ? tool.inputSchema.required as string[] : [] } },
  execute: async args => {
    try { return { success: true, data: await callSpotifyTool(tool.name, args) }; }
    catch(e) { return { success:false,error:String(e) }; }
  },
}));

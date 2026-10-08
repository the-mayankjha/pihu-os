import { z } from 'zod';
// Keep each handler paired with its inferred schema when registering mixed tools.
export function defineTool(definition) {
    return {
        ...definition,
        register(server) {
            server.registerTool(definition.name, {
                description: definition.description,
                inputSchema: z.object(definition.schema),
            }, definition.handler);
        },
    };
}

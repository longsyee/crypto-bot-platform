import { z } from "zod";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { tools } from "./tools/index.js";

function zodToJsonSchema(schema: z.ZodTypeAny): any {
  const def = (schema as any)._def;
  const typeName = def?.typeName || "";

  if (typeName === "ZodString") return { type: "string" };
  if (typeName === "ZodNumber") return { type: "number" };
  if (typeName === "ZodBoolean") return { type: "boolean" };
  if (typeName === "ZodArray") {
    return { type: "array", items: zodToJsonSchema(def.type) };
  }
  if (typeName === "ZodObject") {
    const shape = def.shape();
    const properties: Record<string, any> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value as z.ZodTypeAny);
      if (!((value as any)._def?.typeName === "ZodOptional")) required.push(key);
    }
    return { type: "object", properties, required };
  }
  if (typeName === "ZodOptional") {
    return zodToJsonSchema(def.innerType);
  }
  if (typeName === "ZodEnum") {
    return { type: "string", enum: def.values };
  }
  if (typeName === "ZodDefault") {
    return zodToJsonSchema(def.innerType);
  }
  if (typeName === "ZodRecord") {
    return { type: "object", additionalProperties: true };
  }
  if (typeName === "ZodUnion") {
    return { type: "object" };
  }
  return { type: "object" };
}

export function createMcpServer(): Server {
  const server = new Server(
    {
      name: "nexusbot-trading-platform",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const toolList: Tool[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: zodToJsonSchema(t.inputSchema),
  }));

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: toolList };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = tools.find((t) => t.name === name);
    if (!tool) {
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    const parseResult = tool.inputSchema.safeParse(args || {});
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return {
        content: [{ type: "text", text: `Validation error: ${issues}` }],
        isError: true,
      };
    }

    try {
      return await tool.execute(parseResult.data);
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `Tool execution error: ${e.message || String(e)}` }],
        isError: true,
      };
    }
  });

  return server;
}

export async function startStdioServer() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Keep process alive
  return new Promise(() => {});
}

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export type MCPTool = {
  name: string;
  description: string;
  inputSchema?: any;
};

export async function getMCPTools(): Promise<MCPTool[]> {
  try {
    const url = new URL("http://localhost:8000/pokemon");
    const transport = new StreamableHTTPClientTransport(url);

    const client = new Client(
      { name: "chat-client", version: "1.0.0" },
      { capabilities: {} }
    );

    await client.connect(transport);
    const response = await client.listTools();
    return response.tools.map((tool) => ({
      name: tool.name,
      description: tool.description || "Sin descripción",
      inputSchema: tool.inputSchema
    }));
  } catch (error) {
    console.error("Error getting MCP tools:", error);
    return [];
  }
}

export async function executeMCPTool(
  toolName: string,
  args: Record<string, any>
) {
  const url = new URL("http://localhost:8000/pokemon");
  const transport = new StreamableHTTPClientTransport(url);

  const client = new Client(
    { name: "chat-client", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  const result = await client.callTool({ name: toolName, arguments: args });
  return result;
}

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { loadServerUrls } from "./mcpConfig.js";

export type MCPTool = {
  name: string;
  description: string;
  inputSchema?: any;
};

const DEFAULT_TENANT = Number(process.env.MCP_DEFAULT_TENANT ?? "1");

function withDefaultTenant(args: Record<string, any> = {}) {
  // Respetar tenant explícito; solo inyectar cuando no se envíe.
  if (Object.prototype.hasOwnProperty.call(args, "tenant")) return args;
  if (Number.isNaN(DEFAULT_TENANT)) return args;
  return { tenant: DEFAULT_TENANT, ...args };
}

function normalizeUrls(serverUrls: string[]): string[] {
  return Array.from(new Set((serverUrls || []).filter(Boolean)));
}

async function createClient(serverUrl: string) {
  const url = new URL(serverUrl);
  const transport = new StreamableHTTPClientTransport(url);
  const client = new Client(
    { name: "chat-client", version: "1.0.0" },
    { capabilities: {} }
  );
  await client.connect(transport);
  return client;
}

/**
 * Obtiene las herramientas de un servidor MCP específico.
 * Si no se pasa `serverUrl`, usa la URL por defecto.
 */
export async function getMCPTools(serverUrl?: string): Promise<MCPTool[]> {
  try {
    if (serverUrl) {
      const client = await createClient(serverUrl);
      const response = await client.listTools();
      return response.tools.map((tool) => ({
        name: tool.name,
        description: tool.description || "Sin descripción",
        inputSchema: tool.inputSchema
      }));
    }

    // Sin URL: cargar desde configuración y aplanar resultados
    const urls = await loadServerUrls();
    if (!urls.length) return [];
    const perServer = await getMCPToolsFromServers(urls);
    return perServer.flatMap((r) => r.tools);
  } catch (error) {
    console.error(`Error getting MCP tools${serverUrl ? ` from ${serverUrl}` : " from config"}:`, error);
    return [];
  }
}

/**
 * Obtiene herramientas de múltiples servidores MCP.
 * Devuelve un arreglo con el origen y sus herramientas.
 */
export async function getMCPToolsFromServers(serverUrls: string[]): Promise<Array<{ serverUrl: string; tools: MCPTool[] }>> {
  const unique = normalizeUrls(serverUrls);
  const toolsPerServer = await Promise.all(
    unique.map(async (url) => ({ serverUrl: url, tools: await getMCPTools(url) }))
  );
  return toolsPerServer;
}

/**
 * Ejecuta una herramienta en un servidor MCP específico.
 */
export async function executeMCPTool(
  toolName: string,
  args: Record<string, any>,
  serverUrl?: string
) {
  const toolArgs = withDefaultTenant(args);
  if (serverUrl) {
    const client = await createClient(serverUrl);
    const result = await client.callTool({ name: toolName, arguments: toolArgs });
    return result;
  }
  console.log(args);
  // Sin URL: intentar en todos los servidores configurados y devolver el primer éxito
  const urls = await loadServerUrls();
  if (!urls.length) throw new Error("No hay servidores configurados en mcp.json ni en MCP_SERVERS");
  let lastErr: Error | null = null;
  for (const url of urls) {
    try {
      const client = await createClient(url);
      const result = await client.callTool({ name: toolName, arguments: toolArgs });
      return result;
    } catch (e) {
      lastErr = e as Error;
      continue;
    }
  }
  throw lastErr ?? new Error("Fallo al ejecutar herramienta en servidores configurados");
}



import { deepStrictEqual } from "assert";
import fs from "fs/promises";

export type MCPServerEntry = {
  id?: string;
  url: string;
  headers?: Record<string, string>;
};

export type MCPConfig = {
  servers: MCPServerEntry[];
};

const DEFAULT_CONFIG_PATH = "./mcp.json";

function dedupe(urls: string[]): string[] {
  return Array.from(new Set(urls.filter(Boolean)));
}

export async function loadMCPConfig(configPath?: string): Promise<MCPConfig | null> {
  const path = configPath || DEFAULT_CONFIG_PATH;
  try {
    const raw = await fs.readFile(path, "utf8");
    const json = JSON.parse(raw);
    return normalizeConfig(json);
  } catch (err) {
      console.error(`Error al leer o parsear el archivo ${path}:`, err);
    return null;
  }
}

function normalizeConfig(json: any): MCPConfig {
  const servers: MCPServerEntry[] = Array.isArray(json?.servers)
    ? json.servers
        .filter((s: any) => s && typeof s.url === "string")
        .map((s: any) => ({ id: s.id, url: s.url, headers: s.headers || {} }))
    : [];
  return { servers };
}

export async function loadServerUrls(configPath?: string): Promise<string[]> {
  // Cargar desde mcp.json
  const cfg = await loadMCPConfig(configPath);
  if (cfg && cfg.servers.length) {
    return dedupe(cfg.servers.map((s) => s.url));
  }
  return [];
}

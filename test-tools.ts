/**
 * Script de prueba para visualizar las herramientas disponibles
 * Este script muestra cómo configurar correctamente el cliente MCP
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { loadServerUrls } from "./src/utils/mcpConfig.js";

async function testConnection() {
  try {
    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║        PRUEBA DE CLIENTE MCP - POKEMON API             ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    // Tomar SIEMPRE desde mcp.json/env
    const serverUrls = await loadServerUrls();
    if (!serverUrls.length) {
      console.log("⚠️  No hay servidores configurados en mcp.json ni en MCP_SERVERS.");
      console.log("   Agrega servidores en mcp.json o define MCP_SERVERS.");
      return;
    }

    for (const serverUrl of serverUrls) {
      console.log("\n" + "=".repeat(70));
      console.log(`🌐 Servidor: ${serverUrl}`);
      console.log("=".repeat(70) + "\n");

      // Configuración del transporte Streamable HTTP
      console.log("📡 Configurando transporte Streamable HTTP...");
      const url = new URL(serverUrl);
      console.log(`   URL: ${url.toString()}\n`);

      const transport = new StreamableHTTPClientTransport(url);

      // Crear cliente MCP
      console.log("🔧 Creando cliente MCP...");
      const client = new Client(
        {
          name: "multi-client",
          version: "1.0.0"
        },
        {
          capabilities: {}
        }
      );

      // Conectar
      console.log("🔗 Intentando conectar al servidor...\n");
      await client.connect(transport);

      console.log("✅ ¡Conexión exitosa!\n");

      // Obtener herramientas
      console.log("📋 Obteniendo herramientas disponibles...\n");
      const response = await client.listTools();
      const tools = response.tools;

      if (tools.length === 0) {
        console.log("⚠️  No hay herramientas disponibles en el servidor.");
        continue;
      }

      console.log(`✨ Se encontraron ${tools.length} herramienta(s):\n`);
      console.log("─".repeat(60));

      tools.forEach((tool, index) => {
        console.log(`\n${index + 1}. ${tool.name}`);
        console.log(`   ${"-".repeat(tool.name.length)}`);
        
        if (tool.description) {
          console.log(`   📝 ${tool.description}`);
        }

        if (tool.inputSchema && typeof tool.inputSchema === "object") {
          const schema = tool.inputSchema as any;
          if (schema.properties) {
            console.log(`   📥 Parámetros de entrada:`);
            Object.entries(schema.properties).forEach(([key, value]: any) => {
              console.log(
                `      • ${key}: ${value.type || "any"}${
                  value.description ? ` - ${value.description}` : ""
                }`
              );
            });
          }
        }
      });

      console.log("\n" + "─".repeat(60));
      console.log("\n✅ Listado completado.\n");

      // Ejemplo de llamada a herramienta
      const firstTool = tools[0];
      if (firstTool) {
        console.log(`🚀 Intentando llamar a: ${firstTool.name}\n`);
        try {
          const result = await client.callTool({
            name: firstTool.name,
            arguments: {}
          });
          console.log("📤 Resultado:");
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.log(`⚠️  Error al llamar a la herramienta:`);
          console.log(`   ${(error as Error).message}`);
        }
      }
    }
  } catch (error) {
    const errorMsg = (error as Error).message;
    console.error("\n❌ Error de conexión:");
    console.error(`   ${errorMsg}\n`);

    console.log("💡 Solución de problemas:");
    console.log("   1. Verifica que el servidor MCP esté ejecutándose");
    console.log("   2. Comprueba que el URL es correcto");
    console.log("   3. Asegúrate de que el servidor acepta conexiones Streamable HTTP");
    console.log("   4. Revisa los logs del servidor para más detalles\n");
  }
}

// Ejecutar
testConnection();

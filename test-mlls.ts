/**
 * Script de prueba para visualizar la integración con MCP (Model Context Protocol) 
 * Este script muestra cómo configurar correctamente los clientes de OpenAI y Gemini
 * para utilizar herramientas definidas en un servidor MCP.
 */

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

// Configurar clientes de IA
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
  defaultHeaders: {
    "user-agent": "mcp-client/1.0.0"
  }
});

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Función para obtener herramientas del MCP
async function getMCPTools() {
  try {
    const url = new URL("http://localhost:8000/pokemon");
    const transport = new StreamableHTTPClientTransport(url);

    const client = new Client(
      {
        name: "chat-client",
        version: "1.0.0"
      },
      {
        capabilities: {}
      }
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

// Función para ejecutar una herramienta MCP
async function executeMCPTool(toolName: string, args: Record<string, any>) {
  try {
    const url = new URL("http://localhost:8000/pokemon");
    const transport = new StreamableHTTPClientTransport(url);

    const client = new Client(
      {
        name: "chat-client",
        version: "1.0.0"
      },
      {
        capabilities: {}
      }
    );

    await client.connect(transport);
    const result = await client.callTool({
      name: toolName,
      arguments: args
    });

    return result;
  } catch (error) {
    throw new Error(`Error ejecutando ${toolName}: ${(error as Error).message}`);
  }
}

// API: Chat con OpenAI
app.post("/api/chat/openai", async (req, res) => {
  try {
    const { message, model = "gpt-4" } = req.body;

    // Obtener herramientas disponibles
    const tools = await getMCPTools();
    const toolDefinitions = tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema || {
          type: "object",
          properties: {}
        }
      }
    }));

    // Primer llamado a OpenAI
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: message
      }
    ];

    let completion = await openai.chat.completions.create({
      model,
      max_tokens: 4096,
      tools: toolDefinitions as any,
      messages,
      tool_choice: "auto"
    });

    let finalContent = "";
    let toolUseCount = 0;

    // Procesar tool calls en bucle
    while (
      completion.choices[0]?.finish_reason === "tool_calls" &&
      toolUseCount < 5
    ) {
      toolUseCount++;
      const toolCalls = completion.choices[0]?.message?.tool_calls || [];
      if (!toolCalls.length) break;

      for (const rawToolCall of toolCalls) {
        const toolCall = rawToolCall as any;
        const toolName = toolCall.function?.name as string;
        let toolArgs: Record<string, any> = {};
        try {
          toolArgs = JSON.parse(toolCall.function?.arguments || "{}");
        } catch (_) {
          toolArgs = {};
        }

        console.log(`Ejecutando herramienta: ${toolName}`);

        let toolResult;
        try {
          toolResult = await executeMCPTool(toolName, toolArgs);
        } catch (error) {
          toolResult = { error: (error as Error).message };
        }

        messages.push({
          role: "assistant",
          content: completion.choices[0]?.message?.content || "",
          tool_calls: toolCalls as any
        });

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult)
        } as any);
      }

      completion = await openai.chat.completions.create({
        model,
        max_tokens: 4096,
        tools: toolDefinitions as any,
        messages,
        tool_choice: "auto"
      });
    }

    const choiceContent = completion.choices[0]?.message?.content;
    if (typeof choiceContent === "string") {
      finalContent = choiceContent;
    } else if (Array.isArray(choiceContent)) {
      const parts = choiceContent as any[];
      finalContent = parts
        .filter((c: any) => c && (c as any).type === "text")
        .map((c: any) => (c as any).text)
        .join("\n");
    }

    res.json({
      success: true,
      message: finalContent,
      toolsUsed: toolUseCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// API: Chat con Gemini
app.post("/api/chat/gemini", async (req, res) => {
  try {
    const { message, model = "gemini-pro" } = req.body;

    // Obtener herramientas disponibles
    const tools = await getMCPTools();
    const toolDefinitions = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        properties: tool.inputSchema?.properties || {},
        required: tool.inputSchema?.required || []
      }
    }));

    const modelInstance = gemini.getGenerativeModel({
      model,
      tools: [
        {
          functionDeclarations: toolDefinitions as any
        }
      ]
    });

    let response = await modelInstance.generateContent(message);
    let finalContent = "";
    let toolUseCount = 0;

    // Procesar function calls en bucle
    while (
      (response.response as any)?.functionCalls &&
      (response.response as any).functionCalls.length > 0 &&
      toolUseCount < 5
    ) {
      toolUseCount++;
      const functionCall = (response.response as any).functionCalls[0] as any;

      console.log(`Ejecutando función: ${functionCall.name}`);

      let toolResult;
      try {
        toolResult = await executeMCPTool(
          functionCall.name,
          functionCall.args as Record<string, any>
        );
      } catch (error) {
        toolResult = { error: (error as Error).message };
      }

      // Siguiente llamado con resultado
      response = await modelInstance.generateContent([
        {
          role: "user",
          parts: [{ text: message }]
        },
        {
          role: "model",
          parts: [{ functionCall }]
        },
        {
          role: "user",
          parts: [
            {
              functionResponse: {
                name: functionCall.name,
                response: toolResult
              }
            }
          ]
        }
      ] as any);
    }

    // Extraer contenido final
    const textContent = response.response
      .candidates?.[0]?.content?.parts?.find(
        (part: any) => part.text !== undefined
      );
    if (textContent && textContent.text) {
      finalContent = textContent.text;
    }

    res.json({
      success: true,
      message: finalContent,
      toolsUsed: toolUseCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// API: Obtener herramientas disponibles
app.get("/api/tools", async (req, res) => {
  try {
    const tools = await getMCPTools();
    res.json({
      success: true,
      tools
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// Servir página principal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`\n╔════════════════════════════════════════════════════════╗`);
  console.log(`║        CLIENTE MCP CHAT - IA CON HERRAMIENTAS         ║`);
  console.log(`╚════════════════════════════════════════════════════════╝\n`);
  console.log(`🌐 Servidor ejecutándose en: http://localhost:${PORT}`);
  console.log(`🤖 Modelos disponibles: OpenAI (GPT-4) y Google Gemini`);
  console.log(`📡 Conectando a MCP en: http://localhost:8000/pokemon\n`);
  console.log(`⚙️  Variables de entorno requeridas:`);
  console.log(`   - OPENAI_API_KEY (para usar OpenAI)`);
  console.log(`   - GEMINI_API_KEY (para usar Gemini)\n`);
});

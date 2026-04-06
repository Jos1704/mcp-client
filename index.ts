import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { OpenAIService } from "./src/services/openaiService.js";
import { GeminiService } from "./src/services/geminiService.js";
import { BedrockService } from "./src/services/bedrockService.js";
import { LocalLLMService } from "./src/services/localLLMService.js";
import { getMCPTools } from "./src/utils/mcp.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

// Configurar servicios
const openaiService = new OpenAIService(process.env.OPENAI_API_KEY);
const geminiService = new GeminiService(process.env.GEMINI_API_KEY);
const bedrockService = new BedrockService(process.env.AWS_REGION);
const localLLMService = new LocalLLMService();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// API: Chat con OpenAI
app.post("/api/chat/openai", async (req, res) => {
  try {
    const { message, model = "gpt-4" } = req.body;
    const result = await openaiService.chat(message, model);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// API: Chat con Gemini
app.post("/api/chat/gemini", async (req, res) => {
  try {
    const { message, model = "gemini-pro" } = req.body;
    const result = await geminiService.chat(message, model);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// API: Chat con AWS Bedrock (Claude 3.x)
app.post("/api/chat/bedrock", async (req, res) => {
  try {
    if (!process.env.AWS_REGION) {
      return res.status(400).json({ success: false, error: "Configura AWS_REGION para usar Bedrock" });
    }
    const { message, model = "anthropic.claude-3-5-sonnet-20240620-v1:0" } = req.body;
    const result = await bedrockService.chat(message, model);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// API: Consulta Bedrock Knowledge Base
app.post("/api/chat/bedrock/kb", async (req, res) => {
  try {
    const { prompt, knowledgeBaseId, modelArn, searchType } = req.body;
    const result = await bedrockService.chatWithKnowledgeBase(prompt, {
      knowledgeBaseId,
      modelArn,
      searchType
    });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// API: Chat con LLM local
app.post("/api/chat/local", async (req, res) => {
  try {
    const { message, model } = req.body;
    const result = await localLLMService.chat(message, model);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// API: Obtener herramientas disponibles
app.get("/api/tools", async (req, res) => {
  try {
    const tools = await getMCPTools();
    res.json({ success: true, tools });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
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
  console.log(`⚙️  Variables de entorno requeridas:`);
  console.log(`   - OPENAI_API_KEY (para usar OpenAI)`);
  console.log(`   - GEMINI_API_KEY (para usar Gemini)\n`);
});

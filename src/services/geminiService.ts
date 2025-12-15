import { GoogleGenerativeAI } from "@google/generative-ai";
import { getMCPTools, executeMCPTool } from "../utils/mcp.js";

export class GeminiService {
  private client: GoogleGenerativeAI;

  constructor(apiKey: string | undefined) {
    this.client = new GoogleGenerativeAI(apiKey || "");
  }

  async chat(message: string, model = "gemini-pro") {
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

    const modelInstance = this.client.getGenerativeModel({
      model,
      tools: [{ functionDeclarations: toolDefinitions as any }]
    });

    let response = await modelInstance.generateContent(message);
    let finalContent = "";
    let toolUseCount = 0;

    while (
      (response.response as any)?.functionCalls &&
      (response.response as any).functionCalls.length > 0 &&
      toolUseCount < 5
    ) {
      toolUseCount++;
      const functionCall = (response.response as any).functionCalls[0] as any;

      let toolResult;
      try {
        toolResult = await executeMCPTool(
          functionCall.name,
          (functionCall.args as Record<string, any>) || {}
        );
      } catch (error) {
        toolResult = { error: (error as Error).message };
      }

      response = await modelInstance.generateContent([
        { role: "user", parts: [{ text: message }] },
        { role: "model", parts: [{ functionCall }] },
        {
          role: "user",
          parts: [
            { functionResponse: { name: functionCall.name, response: toolResult } }
          ]
        }
      ] as any);
    }

    const textContent = response.response
      .candidates?.[0]?.content?.parts?.find((p: any) => p.text !== undefined);
    if (textContent && textContent.text) {
      finalContent = textContent.text;
    }

    return { message: finalContent, toolsUsed: toolUseCount };
  }
}

import OpenAI from "openai";
import { getMCPTools, executeMCPTool } from "../utils/mcp.js";

export class OpenAIService {
  private client: OpenAI;

  constructor(apiKey: string | undefined) {
    this.client = new OpenAI({
      apiKey: apiKey || "",
      defaultHeaders: { "user-agent": "mcp-client/1.0.0" }
    });
  }

  async chat(message: string, model = "gpt-4") {
    const tools = await getMCPTools();
    const toolDefs = tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema || { type: "object", properties: {} }
      }
    }));

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "user", content: message }
    ];

    let completion = await this.client.chat.completions.create({
      model,
      max_tokens: 4096,
      tools: toolDefs as any,
      messages,
      tool_choice: "auto"
    });

    let finalContent = "";
    let toolUseCount = 0;

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

      completion = await this.client.chat.completions.create({
        model,
        max_tokens: 4096,
        tools: toolDefs as any,
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

    return { message: finalContent, toolsUsed: toolUseCount };
  }
}

import {
  BedrockRuntimeClient,
  InvokeModelCommand
} from "@aws-sdk/client-bedrock-runtime";
import {
  BedrockAgentRuntimeClient,
  RetrieveAndGenerateCommand
} from "@aws-sdk/client-bedrock-agent-runtime";
import { getMCPTools, executeMCPTool } from "../utils/mcp.js";

export class BedrockService {
  private client: BedrockRuntimeClient;
  private agentClient: BedrockAgentRuntimeClient;

  constructor(region: string | undefined) {
    this.client = new BedrockRuntimeClient({ region: region || "us-east-1" });
    this.agentClient = new BedrockAgentRuntimeClient({ region: region || "us-east-1" });
  }

  async chat(
    message: string,
    model = "anthropic.claude-3-5-sonnet-20240620-v1:0"
  ) {
    const tools = await getMCPTools();
    const toolDefinitions = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema || { type: "object", properties: {} }
    }));

    const messages: any[] = [
      { role: "user", content: [{ type: "text", text: message }] }
    ];

    let toolUseCount = 0;
    let finalContent = "";

    while (toolUseCount < 5) {
      const payload = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 4096,
        messages,
        tools: toolDefinitions
      };

      const command = new InvokeModelCommand({
        modelId: model,
        body: JSON.stringify(payload),
        contentType: "application/json",
        accept: "application/json"
      });

      const response = await this.client.send(command);
      const rawBody = response.body ?? new Uint8Array();
      const decoded =
        typeof rawBody === "string"
          ? rawBody
          : new TextDecoder().decode(rawBody as Uint8Array);
      const body = JSON.parse(decoded);
      const content = body.content || [];

      const toolUse = content.find((c: any) => c.type === "tool_use");
      if (toolUse) {
        toolUseCount++;
        let toolResult;
        try {
          toolResult = await executeMCPTool(toolUse.name, toolUse.input || {});
        } catch (error) {
          toolResult = { error: (error as Error).message };
        }

        messages.push({ role: "assistant", content });
        messages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: JSON.stringify(toolResult)
            }
          ]
        });
        continue;
      }

      const textParts = content
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("\n");

      finalContent = textParts;
      break;
    }

    if (!finalContent) {
      finalContent = "No se obtuvo respuesta del modelo de Bedrock.";
    }

    return { message: finalContent, toolsUsed: toolUseCount };
  }

  async chatWithKnowledgeBase(
    prompt: string,
    {
      knowledgeBaseId,
      modelArn = process.env.BEDROCK_KB_MODEL_ARN ||
        "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0",
      searchType = "HYBRID"
    }: {
      knowledgeBaseId: string;
      modelArn?: string;
      searchType?: "HYBRID" | "SEMANTIC";
    }
  ) {
    if (!knowledgeBaseId) {
      throw new Error("knowledgeBaseId es requerido para consultar la base de conocimiento");
    }

    const command = new RetrieveAndGenerateCommand({
      input: { text: prompt.trim() },
      retrieveAndGenerateConfiguration: {
        type: "KNOWLEDGE_BASE",
        knowledgeBaseConfiguration: {
          knowledgeBaseId,
          modelArn,
          generationConfiguration: {
            inferenceConfig: {
              textInferenceConfig: {
                temperature: 0.1,
                maxTokens: 800,
                topP: 0.9
              }
            }
          },
          retrievalConfiguration: {
            vectorSearchConfiguration: {
              numberOfResults: 3,
              overrideSearchType: searchType
            }
          }
        }
      }
    });

    const response = await this.agentClient.send(command);
    const text = response.output?.text || "";
    const citations =
      response.citations
        ?.map((c) => c.retrievedReferences?.[0]?.location?.s3Location?.uri)
        .filter(Boolean) || [];

    return { message: text, citations, toolsUsed: 0 };
  }
}

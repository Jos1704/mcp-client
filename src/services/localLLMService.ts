type LocalLLMConfig = {
  baseUrl?: string;
  model?: string;
};

export class LocalLLMService {
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: LocalLLMConfig = {}) {
    this.baseUrl = config.baseUrl || process.env.LOCAL_LLM_URL || "http://localhost:11434";
    this.defaultModel = config.model || process.env.LOCAL_LLM_MODEL || "local-model";
  }

  async chat(message: string, model?: string) {
    const targetModel = model || this.defaultModel;

    const resp = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: targetModel,
        messages: [{ role: "user", content: message }]
      })
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Local LLM error ${resp.status}: ${text}`);
    }

    const data = await resp.json() as { message?: string; choices?: Array<{ message?: { content?: string } }> };
    // Expecting { message: string } or OpenAI-style choices
    let finalContent = "";
    if (data.message) {
      finalContent = data.message;
    } else if (data.choices?.[0]?.message?.content) {
      finalContent = data.choices[0].message.content;
    }

    return { message: finalContent || "", toolsUsed: 0 };
  }
}

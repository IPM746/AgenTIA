import { LLMClient, LLMResponse, Message, ToolCall } from './client';

export class OpenRouterProvider implements LLMClient {
  constructor(private apiKey: string, private model: string) {}

  async chat(messages: Message[], tools: any[] = []): Promise<LLMResponse> {
    // Transformamos los mensajes al estándar de OpenRouter/OpenAI
    const formattedMessages = messages.map(m => ({
      role: m.role,
      content: m.content,
      ...(m.toolCallId && { tool_call_id: m.toolCallId })
    }));

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: formattedMessages,
        tools: tools.length > 0 ? tools : undefined
      })
    });

    if (!response.ok) throw new Error(`OpenRouter API Error: ${response.statusText}`);
    const data = await response.json();
    const choice = data.choices[0];

    const toolCalls = choice.message.tool_calls?.map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      args: JSON.parse(tc.function.arguments)
    }));

    return {
      text: choice.message.content || '',
      toolCalls,
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens
      }
    };
  }
}
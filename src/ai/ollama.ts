import {
  LLMClient,
  LLMResponse,
  Message,
  LLMUsage,
  ToolCall
} from './client';

interface OllamaToolCall {
  function?: {
    name?: string;
    arguments?: Record<string, any> | string;
  };
  id?: string;
}

export class OllamaProvider implements LLMClient {
  private baseUrl: string;

  constructor(
    private model: string = 'qwen3.5:4b',
    baseUrl: string = 'http://localhost:11434'
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async chat(
    messages: Message[],
    tools: any[] = []
  ): Promise<LLMResponse> {
    const formattedMessages = messages.map((message) => {
      if (message.role === 'assistant') {
        return {
          role: 'assistant',
          content: message.content || '',
          ...(message.toolCalls?.length
            ? {
                tool_calls: message.toolCalls.map((call) => ({
                  id: call.id,
                  type: 'function',
                  function: {
                    name: call.name,
                    arguments: JSON.stringify(call.args)
                  }
                }))
              }
            : {})
        };
      }

      if (message.role === 'tool') {
        return {
          role: 'tool',
          content: message.content,
          ...(message.toolCallId
            ? { tool_call_id: message.toolCallId }
            : {})
        };
      }

      return {
        role: message.role,
        content: message.content
      };
    });

    const formattedTools = tools.flatMap((tool) => {
      if (!tool.functionDeclarations) {
        return [];
      }

      return tool.functionDeclarations.map((declaration: any) => ({
        type: 'function',
        function: {
          name: declaration.name,
          description: declaration.description,
          parameters: declaration.parametersJsonSchema
        }
      }));
    });

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages: formattedMessages,
        tools: formattedTools.length > 0 ? formattedTools : undefined,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Ollama API Error ${response.status}: ${errorText}`
      );
    }

    const data = await response.json();

    const rawToolCalls: OllamaToolCall[] =
      data.message?.tool_calls || [];

    const toolCalls: ToolCall[] = rawToolCalls.map(
      (call, index) => {
        let args: Record<string, any> = {};

        if (typeof call.function?.arguments === 'string') {
          try {
            args = JSON.parse(call.function.arguments);
          } catch {
            throw new Error(
              `Ollama devolvió argumentos JSON inválidos para la herramienta '${call.function?.name}'.`
            );
          }
        } else {
          args = call.function?.arguments || {};
        }

        return {
          id:
            call.id ||
            `ollama-${Date.now()}-${index}`,
          name:
            call.function?.name ||
            'herramienta_desconocida',
          args
        };
      }
    );

    const usage: LLMUsage | undefined =
      data.prompt_eval_count !== undefined ||
      data.eval_count !== undefined
        ? {
            promptTokens: data.prompt_eval_count,
            completionTokens: data.eval_count,
            totalTokens:
              (data.prompt_eval_count || 0) +
              (data.eval_count || 0),
            estimated: false
          }
        : undefined;

    return {
      text: data.message?.content || '',
      toolCalls:
        toolCalls.length > 0
          ? toolCalls
          : undefined,
      usage
    };
  }
}
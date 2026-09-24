import {
  LLMClient,
  LLMResponse,
  Message,
  LLMUsage,
  ToolCall
} from './client';
import { toOpenAICompatibleTools } from './toolAdapters';
import { Tool } from '../tools/types';

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
    tools: readonly Tool[] = []
  ): Promise<LLMResponse> {
    const formattedMessages = this.formatMessages(messages);
    const formattedTools = toOpenAICompatibleTools(tools);

    const requestBody = {
      model: this.model,
      messages: formattedMessages,
      ...(formattedTools.length > 0
        ? { tools: formattedTools }
        : {}),
      stream: false
    };

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `Ollama API Error ${response.status}: ${errorText}`
      );
    }

    const data = await response.json();

    return this.parseResponse(data);
  }

  /**
   * Convierte nuestro formato interno de mensajes
   * al formato compatible con Ollama.
   */
  private formatMessages(messages: Message[]) {
    return messages.map((message) => {
      // Mensaje del assistant
      if (message.role === 'assistant') {
        const formattedMessage: any = {
          role: 'assistant',
          content: message.content || ''
        };

        if (message.toolCalls?.length) {
          formattedMessage.tool_calls = message.toolCalls.map(
            (call) => ({
              id: call.id,
              type: 'function',
              function: {
                name: call.name,
                arguments: call.args
              }
            })
          );
        }

        return formattedMessage;
      }

      // Resultado de una tool
      if (message.role === 'tool') {
        return {
          role: 'tool',
          content: message.content,
          ...(message.toolCallId
            ? {
                tool_call_id: message.toolCallId
              }
            : {}),
          ...(message.toolName
            ? {
                name: message.toolName
              }
            : {})
        };
      }

      // user / system
      return {
        role: message.role,
        content: message.content
      };
    });
  }

  /**
   * Convierte la respuesta de Ollama al contrato
   * común de AgenTIA.
   */
  private parseResponse(data: any): LLMResponse {
    const rawToolCalls: OllamaToolCall[] =
      data.message?.tool_calls || [];

    const toolCalls: ToolCall[] = rawToolCalls.map(
      (call, index) => {
        let args: Record<string, any> = {};

        const rawArguments = call.function?.arguments;

        if (typeof rawArguments === 'string') {
          try {
            args = JSON.parse(rawArguments);
          } catch {
            throw new Error(
              `Ollama devolvió argumentos JSON inválidos para la herramienta '${call.function?.name}'. ` +
                `Argumentos recibidos: ${rawArguments}`
            );
          }
        } else if (
          rawArguments &&
          typeof rawArguments === 'object'
        ) {
          args = rawArguments;
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

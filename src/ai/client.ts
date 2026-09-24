export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, any>;

  /**
   * Metadata opcional específica de algunos providers.
   *
   * Gemini puede utilizarla para conservar información
   * necesaria entre llamadas con tool calling.
   *
   * Otros providers, como Ollama, simplemente la ignoran.
   */
  thoughtSignature?: string;
}

export interface LLMUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimated?: boolean;
}

export interface LLMResponse {
  text: string;
  toolCalls?: ToolCall[];
  usage?: LLMUsage;
}

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  source?: 'system' | 'user' | 'project_memory' | 'tool_result' | 'internal';

  /**
   * Identificador de la llamada a tool a la que
   * corresponde este mensaje.
   */
  toolCallId?: string;

  /**
   * Nombre de la tool ejecutada.
   */
  toolName?: string;

  /**
   * Tool calls generadas por el assistant.
   */
  toolCalls?: ToolCall[];
}

export interface LLMClient {
  /**
   * Envía una conversación al provider.
   *
   * Cada provider es responsable de traducir:
   *
   *   Message[] + tools
   *
   * al formato específico de su API.
   */
  chat(
    messages: Message[],
    tools?: readonly Tool[]
  ): Promise<LLMResponse>;
}
import { Tool } from '../tools/types';

// src/ai/client.ts

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface LLMResponse {
  text: string;
  toolCalls?: ToolCall[];
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCallId?: string; // Para vincular las respuestas de las herramientas
}

export interface LLMClient {
  /**
   * Envía una lista de mensajes al modelo y devuelve su respuesta estandarizada.
   */
  chat(messages: Message[], tools?: any[]): Promise<LLMResponse>;
}
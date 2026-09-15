export interface ToolCall {
  id: string;
  name: string;
args: Record<string, any>;
  // TODO (Deuda Técnica): Específico de Gemini 3.
  // En el futuro debería abstraerse como provider metadata.
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

  toolCallId?: string;
  toolName?: string;
  toolCalls?: ToolCall[];
}

export interface LLMClient {
  chat(messages: Message[], tools?: any[]): Promise<LLMResponse>;
}
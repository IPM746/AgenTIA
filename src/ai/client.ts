// src/ai/client.ts

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
  thoughtSignature?: string;

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

  toolCallId?: string;
  toolName?: string;
  toolCalls?: ToolCall[];
}

export interface LLMClient {
  chat(messages: Message[], tools?: any[]): Promise<LLMResponse>;
}
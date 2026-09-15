
import { GoogleGenAI } from '@google/genai';
import {
  LLMClient,
  Message,
  LLMResponse,
  LLMUsage,
  ToolCall
} from './client';

export class GeminiProvider implements LLMClient {
  private ai: GoogleGenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-3.6-flash') {
    this.ai = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async chat(messages: Message[], tools: any[] = []): Promise<LLMResponse> {
    const systemMessage = messages.find(
      m => m.role === 'system'
    )?.content;

    const history = messages.filter(
      m => m.role !== 'system'
    );

    const geminiContents: any[] = [];

    for (const msg of history) {
      if (msg.role === 'user') {
        if (msg.content?.trim()) {
          geminiContents.push({
            role: 'user',
            parts: [
              {
                text: msg.content
              }
            ]
          });
        }

        continue;
      }

      if (msg.role === 'assistant') {
        const parts: any[] = [];

        if (msg.content?.trim()) {
          parts.push({
            text: msg.content
          });
        }

        if (msg.toolCalls && msg.toolCalls.length > 0) {
          for (const call of msg.toolCalls) {
            const functionCallPart: any = {
              functionCall: {
                name: call.name,
                args: call.args
              }
            };

            // Gemini 3 necesita conservar exactamente
            // la thoughtSignature recibida en la respuesta original.
            if (call.thoughtSignature) {
              functionCallPart.thoughtSignature = call.thoughtSignature;
            }

            parts.push(functionCallPart);
          }
        }

        if (parts.length > 0) {
          geminiContents.push({
            role: 'model',
            parts
          });
        }

        continue;
      }

      if (msg.role === 'tool') {
        geminiContents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: msg.toolName || 'herramienta',
                response: {
                  result: msg.content
                }
              }
            }
          ]
        });
      }
    }

    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: geminiContents,
      config: {
        systemInstruction: systemMessage,
        tools: tools.length > 0 ? tools : undefined
      }
    });

    const parsedToolCalls: ToolCall[] = [];

    // Accedemos a los Parts originales de Gemini para no perder
    // thoughtSignature.
    const responseParts =
      response.candidates?.[0]?.content?.parts || [];

    for (const part of responseParts) {
      if (part.functionCall) {
        parsedToolCalls.push({
          id: Math.random().toString(36).substring(7),
          name: part.functionCall.name || 'herramienta_desconocida',
          args: (part.functionCall.args || {}) as Record<string, any>,
          thoughtSignature: part.thoughtSignature
        });
      }
    }

    let safeText = '';

    if (parsedToolCalls.length === 0) {
      try {
        safeText = response.text || '';
      } catch {
        safeText = '';
      }
    }
    let usage: LLMUsage | undefined;
        if (response.usageMetadata) {
            usage = {
                promptTokens: response.usageMetadata.promptTokenCount,
                completionTokens: response.usageMetadata.candidatesTokenCount,
                totalTokens: response.usageMetadata.totalTokenCount,
                estimated: false
            };
        }

        return {
            text: safeText,
            toolCalls: parsedToolCalls.length > 0 ? parsedToolCalls : undefined,
            usage
        };
    }
}


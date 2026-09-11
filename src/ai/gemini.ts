// src/ai/gemini.ts
import { GoogleGenAI } from '@google/genai';
import { LLMClient, LLMResponse, Message, ToolCall } from './client';

export class GeminiProvider implements LLMClient {
  private ai: GoogleGenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-3.6-flash') {
    // La API key se inyecta desde fuera, el proveedor no sabe de dónde viene
    this.ai = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async chat(messages: Message[], tools: any[] = []): Promise<LLMResponse> {
    // 1. Extraemos el system prompt si existe
    const systemMessage = messages.find(m => m.role === 'system')?.content;
    const history = messages.filter(m => m.role !== 'system');

   
   // 2. Traducimos nuestro formato genérico al formato de Gemini
    const geminiContents = history
      .filter(msg => msg.content && msg.content.trim() !== '') // Filtramos mensajes vacíos
      .map(msg => {
        // En Gemini, los resultados de las herramientas se envían desde el lado del "user"
        const role = (msg.role === 'user' || msg.role === 'tool') ? 'user' : 'model';
        return { role, parts: [{ text: msg.content }] };
      });

    // 3. Llamamos a Gemini
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: geminiContents,
      config: {
        systemInstruction: systemMessage,
        tools: tools.length > 0 ? tools : undefined,
      }
    });

    // 4. Mapeamos la respuesta de vuelta a nuestro formato estándar
    const functionCalls = response.functionCalls || [];
    
    const parsedToolCalls: ToolCall[] = functionCalls.map(call => ({
      id: Math.random().toString(36).substring(7),
      name: call.name || 'herramienta_desconocida', // <-- ¡Aquí está la magia!
      args: call.args as Record<string, any>
    }));

    return {
      text: response.text || '',
      toolCalls: parsedToolCalls.length > 0 ? parsedToolCalls : undefined
    };
  }
}
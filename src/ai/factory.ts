// src/ai/factory.ts
import { LLMClient } from './client';
import { GeminiProvider } from './gemini';
// import { OpenAIProvider } from './openai'; // Lo descomentaremos cuando lo programes

export const createAIClient = (provider: string, apiKey: string, model: string): LLMClient => {
  const normalizedProvider = provider.toLowerCase();

  switch (normalizedProvider) {
    case 'gemini':
      return new GeminiProvider(apiKey, model);
      
    case 'openai':
      // Aquí el día de mañana simplemente harás:
      // return new OpenAIProvider(apiKey, model);
      throw new Error("El proveedor OpenAI está preparado en la arquitectura, pero aún no implementado en el código.");
      
    default:
      console.warn(`⚠️ Proveedor '${provider}' no reconocido. Usando Gemini por defecto.`);
      return new GeminiProvider(apiKey, model);
  }
};
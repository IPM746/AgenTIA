import { LLMClient } from './client';
import { GeminiProvider } from './gemini';

export const createAIClient = (
  provider: string,
  apiKey: string,
  model: string
): LLMClient => {
  const normalizedProvider = provider.toLowerCase();

  switch (normalizedProvider) {
    case 'gemini':
      return new GeminiProvider(apiKey, model);

    case 'openai':
      throw new Error(
        "El proveedor OpenAI está preparado en la arquitectura, pero aún no implementado en el código."
      );

    default:
      throw new Error(
        `Proveedor '${provider}' no reconocido. Verifica tu configuración.`
      );
  }
};
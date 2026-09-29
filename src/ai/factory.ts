import { LLMClient } from './client';
import { GeminiProvider } from './gemini';
import { OllamaProvider } from './ollama';
import { OpenRouterProvider } from './openrouter';

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
    case 'ollama':
      return new OllamaProvider(
        model || 'qwen3.5:4b'
      );
    case 'openrouter':
      return new OpenRouterProvider(apiKey, model);
    default:
      throw new Error(
        `Proveedor '${provider}' no reconocido. Verifica tu configuración.`
      );
  }
};

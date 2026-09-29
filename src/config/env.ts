import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface AgentConfig {
  provider: string;
  model: string;
  apiKey: string;
  maxIter: number;
  contextMaxTokens?: number;
  verificationMaxCycles: number;
}

export const getProviderApiKeyName = (
  provider: string,
): string | undefined => {
  switch (provider.toLowerCase()) {
    case 'gemini':
      return 'GEMINI_API_KEY';
    case 'openrouter':
      return 'OPENROUTER_API_KEY';
    default:
      return undefined;
  }
};

const getGlobalConfigPath = (): string => {
  if (os.platform() === 'win32' && process.env.APPDATA) {
    return path.join(
      process.env.APPDATA,
      'ia-agent',
      'config.json'
    );
  }

  return path.join(
    os.homedir(),
    '.config',
    'ia-agent',
    'config.json'
  );
};

export const loadConfig = (): AgentConfig => {
  // --------------------------------------------------
  // 1. Valores por defecto
  // --------------------------------------------------

  let provider = 'gemini';
  let model = 'gemini-3.6-flash';
  let maxIter = 5;
  let contextMaxTokens: number | undefined;
  let verificationMaxCycles = 3;

  // --------------------------------------------------
  // 2. Configuración global
  // --------------------------------------------------

  const configPath = getGlobalConfigPath();

  if (fs.existsSync(configPath)) {
    try {
      const fileConfig = JSON.parse(
        fs.readFileSync(configPath, 'utf-8')
      );

      if (fileConfig.provider) {
        provider = String(
          fileConfig.provider
        ).toLowerCase();
      }

      if (fileConfig.model) {
        model = String(fileConfig.model);
      }

      if (fileConfig.maxIter) {
        maxIter = Number(fileConfig.maxIter);
      }

      if (fileConfig.contextMaxTokens) {
        contextMaxTokens = Number(fileConfig.contextMaxTokens);
      }

      if (fileConfig.verificationMaxCycles) {
        verificationMaxCycles = Number(fileConfig.verificationMaxCycles);
      }
    } catch {
      console.warn(
        '⚠️ Advertencia: Error leyendo el config.json global.'
      );
    }
  }

  // --------------------------------------------------
  // 3. Variables de entorno
  // --------------------------------------------------

  if (process.env.AI_PROVIDER) {
    provider =
      process.env.AI_PROVIDER.toLowerCase();
  }

  if (process.env.AI_MODEL) {
    model = process.env.AI_MODEL;
  }

  if (process.env.AI_CONTEXT_MAX_TOKENS) {
    const configuredBudget = Number(process.env.AI_CONTEXT_MAX_TOKENS);
    if (Number.isFinite(configuredBudget) && configuredBudget > 0) {
      contextMaxTokens = configuredBudget;
    }
  }

  if (process.env.AI_VERIFICATION_MAX_CYCLES) {
    const configuredCycles = Number(process.env.AI_VERIFICATION_MAX_CYCLES);
    if (Number.isFinite(configuredCycles) && configuredCycles > 0) {
      verificationMaxCycles = Math.floor(configuredCycles);
    }
  }

  // --------------------------------------------------
  // 4. Modelo por defecto de Ollama
  // --------------------------------------------------
  //
  // IMPORTANTE:
  // Antes teníamos:
  //
  // if (provider === 'ollama'
  //     && !process.env.AI_MODEL
  //     && !model)
  //
  // Eso no funcionaba porque `model` ya tenía
  // el valor por defecto de Gemini.
  //
  // Si el provider es Ollama y el usuario no ha
  // especificado AI_MODEL, usamos qwen3.5:4b.
  // --------------------------------------------------

  if (
    provider === 'ollama' &&
    !process.env.AI_MODEL
  ) {
    model = 'qwen3.5:4b';
  }

  // --------------------------------------------------
  // 5. API Key
  // --------------------------------------------------

  let apiKey = '';
  let expectedKeyName = '';

  if (provider === 'gemini') {
    expectedKeyName = 'GEMINI_API_KEY';
    apiKey = process.env.GEMINI_API_KEY || '';
  } else if (provider === 'openrouter') {
    expectedKeyName = 'OPENROUTER_API_KEY';
    apiKey = process.env.OPENROUTER_API_KEY || '';
  } else if (provider === 'ollama') {
    // Ollama local no necesita API key.
    apiKey = '';
  }

  if (provider !== 'ollama' && !apiKey) {
    throw new Error(
      `Clave de API no encontrada para el proveedor '${provider}'. ` +
        `Configura la variable de entorno ${expectedKeyName}.`
    );
  }

  // --------------------------------------------------
  // 6. Resultado
  // --------------------------------------------------

  return {
    provider,
    model,
    apiKey,
    maxIter,
    contextMaxTokens,
    verificationMaxCycles: Number.isFinite(verificationMaxCycles) && verificationMaxCycles > 0
      ? Math.floor(verificationMaxCycles)
      : 3,
  };
};

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export const supportedProviders = ['gemini', 'ollama', 'openrouter'] as const;
export type SupportedProvider = typeof supportedProviders[number];

export interface AgentConfig {
  provider: SupportedProvider;
  model: string;
  apiKey: string;
  maxIter: number;
  contextMaxTokens?: number;
  verificationMaxCycles: number;
}

export interface LoadConfigOptions {
  configPath?: string;
  env?: NodeJS.ProcessEnv;
}

interface ConfigFile {
  provider?: unknown;
  model?: unknown;
  maxIter?: unknown;
  contextMaxTokens?: unknown;
  verificationMaxCycles?: unknown;
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

export const getGlobalConfigPath = (): string => {
  if (os.platform() === 'win32' && process.env.APPDATA) {
    return path.join(process.env.APPDATA, 'ia-agent', 'config.json');
  }

  return path.join(os.homedir(), '.config', 'ia-agent', 'config.json');
};

export const getConfigTemplate = (): string => JSON.stringify({
  provider: 'ollama',
  model: 'qwen3.5:4b',
  maxIter: 5,
  contextMaxTokens: 12000,
  verificationMaxCycles: 3,
}, null, 2) + '\n';

const positiveInteger = (value: unknown, name: string): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim()
      ? Number(value)
      : Number.NaN;

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} debe ser un entero positivo.`);
  }

  return parsed;
};

const nonEmptyString = (value: unknown, name: string): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} debe ser un texto no vacío.`);
  }
  return value.trim();
};

const readConfigFile = (configPath: string): ConfigFile => {
  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    const value: unknown = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('El archivo debe contener un objeto JSON.');
    }
    return value as ConfigFile;
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Configuración global inválida en ${configPath}: ${reason}`);
  }
};

const parseProvider = (value: string): SupportedProvider => {
  const provider = value.toLowerCase();
  if (!supportedProviders.includes(provider as SupportedProvider)) {
    throw new Error(`Proveedor no reconocido: '${value}'. Usa gemini, ollama u openrouter.`);
  }
  return provider as SupportedProvider;
};

export const loadConfig = (options: LoadConfigOptions = {}): AgentConfig => {
  const env = options.env ?? process.env;
  const fileConfig = readConfigFile(options.configPath ?? getGlobalConfigPath());
  const fileProvider = nonEmptyString(fileConfig.provider, 'provider');
  const envProvider = nonEmptyString(env.AI_PROVIDER, 'AI_PROVIDER');
  const provider = parseProvider(envProvider ?? fileProvider ?? 'ollama');

  const fileModel = nonEmptyString(fileConfig.model, 'model');
  const envModel = nonEmptyString(env.AI_MODEL, 'AI_MODEL');
  const hasExplicitModel = Boolean(fileModel ?? envModel);
  const defaultModel = provider === 'ollama' ? 'qwen3.5:4b' : 'gemini-3.6-flash';
  const model = envModel ?? fileModel ?? defaultModel;

  const fileMaxIter = positiveInteger(fileConfig.maxIter, 'maxIter');
  const envMaxIter = positiveInteger(env.AI_MAX_ITER, 'AI_MAX_ITER');
  const fileContextMaxTokens = positiveInteger(fileConfig.contextMaxTokens, 'contextMaxTokens');
  const envContextMaxTokens = positiveInteger(env.AI_CONTEXT_MAX_TOKENS, 'AI_CONTEXT_MAX_TOKENS');
  const fileVerificationMaxCycles = positiveInteger(
    fileConfig.verificationMaxCycles,
    'verificationMaxCycles',
  );
  const envVerificationMaxCycles = positiveInteger(
    env.AI_VERIFICATION_MAX_CYCLES,
    'AI_VERIFICATION_MAX_CYCLES',
  );

  const apiKeyName = getProviderApiKeyName(provider);
  const apiKey = apiKeyName ? env[apiKeyName] ?? '' : '';
  if (apiKeyName && !apiKey) {
    throw new Error(
      `Clave de API no encontrada para el proveedor '${provider}'. Configura la variable de entorno ${apiKeyName}.`,
    );
  }

  return {
    provider,
    model: hasExplicitModel ? model : defaultModel,
    apiKey,
    maxIter: envMaxIter ?? fileMaxIter ?? 5,
    contextMaxTokens: envContextMaxTokens ?? fileContextMaxTokens,
    verificationMaxCycles: envVerificationMaxCycles ?? fileVerificationMaxCycles ?? 3,
  };
};

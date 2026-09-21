
// src/config/env.ts
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface AgentConfig {
  provider: string;
  model: string;
  apiKey: string;
  maxIter: number;
}

const getGlobalConfigPath = (): string => {
  if (os.platform() === 'win32' && process.env.APPDATA) {
    return path.join(process.env.APPDATA, 'ia-agent', 'config.json');
  }

  return path.join(os.homedir(), '.config', 'ia-agent', 'config.json');
};

export const loadConfig = (): AgentConfig => {
  // 1. Valores por defecto
  let provider = 'gemini';
  let model = 'gemini-3.6-flash';
  let maxIter = 5;

  // 2. Leemos la configuración global
  //    Esta configuración tiene prioridad sobre los valores por defecto,
  //    pero NO sobre las variables de entorno.
  const configPath = getGlobalConfigPath();

  if (fs.existsSync(configPath)) {
    try {
      const fileConfig = JSON.parse(
        fs.readFileSync(configPath, 'utf-8')
      );

      if (fileConfig.provider) {
        provider = fileConfig.provider.toLowerCase();
      }

      if (fileConfig.model) {
        model = fileConfig.model;
      }

      if (fileConfig.maxIter) {
        maxIter = fileConfig.maxIter;
      }
    } catch (e) {
      console.warn(
        '⚠️ Advertencia: Error leyendo el config.json global.'
      );
    }
  }

  // 3. Las variables de entorno tienen la máxima prioridad.
  if (process.env.AI_PROVIDER) {
    provider = process.env.AI_PROVIDER.toLowerCase();
  }

  if (process.env.AI_MODEL) {
    model = process.env.AI_MODEL;
  }

  // Si se selecciona Ollama y no se especificó modelo,
  // usamos uno local pequeño como valor por defecto.
  if (
    provider === 'ollama' &&
    !process.env.AI_MODEL &&
    !model
  ) {
    model = 'qwen3.5:4b';
  }

  // 4. API key.
  // Ollama local no necesita API key.
  let apiKey = '';
  let expectedKeyName = '';

  if (provider === 'gemini') {
    expectedKeyName = 'GEMINI_API_KEY';
    apiKey = process.env.GEMINI_API_KEY || '';
  } else if (provider === 'openai') {
    expectedKeyName = 'OPENAI_API_KEY';
    apiKey = process.env.OPENAI_API_KEY || '';
  } else if (provider === 'ollama') {
    apiKey = '';
  }

  // 5. Validamos la API key solo cuando el proveedor la necesita.
  if (provider !== 'ollama' && !apiKey) {
    throw new Error(
      `Clave de API no encontrada. Por favor, configura la variable de entorno del sistema: ${expectedKeyName}`
    );
  }

  return {
    provider,
    model,
    apiKey,
    maxIter
  };
};

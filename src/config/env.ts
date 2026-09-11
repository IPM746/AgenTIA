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
  let provider = process.env.AI_PROVIDER || 'gemini';
  let model = process.env.AI_MODEL || 'gemini-3.5-flash';
  let maxIter = 5;

  // 2. Leemos la configuración pública del sistema (NUNCA secretos aquí)
  const configPath = getGlobalConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (fileConfig.provider) provider = fileConfig.provider.toLowerCase();
      if (fileConfig.model) model = fileConfig.model;
      if (fileConfig.maxIter) maxIter = fileConfig.maxIter;
    } catch (e) {
      console.warn("⚠️ Advertencia: Error leyendo el config.json global.");
    }
  }

  // 3. Capturamos el secreto ESTRICTAMENTE de las variables de entorno de Windows/Linux
  let apiKey = '';
  let expectedKeyName = '';

  if (provider === 'gemini') {
    expectedKeyName = 'GEMINI_API_KEY';
    apiKey = process.env.GEMINI_API_KEY || '';
  } else if (provider === 'openai') {
    expectedKeyName = 'OPENAI_API_KEY';
    apiKey = process.env.OPENAI_API_KEY || '';
  }

  // Si no hay clave, lanzamos un error claro que luego interceptará el comando "doctor"
  if (!apiKey) {
    throw new Error(`Clave de API no encontrada. Por favor, configura la variable de entorno del sistema: ${expectedKeyName}`);
  }

  return { provider, model, apiKey, maxIter };
};
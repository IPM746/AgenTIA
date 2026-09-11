// src/cli/doctor.ts
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadConfig } from '../config/env';

export const runDoctor = () => {
  console.log("🩺 Iniciando diagnóstico de ia-agent...\n");

  let hasErrors = false;

  // 1. Comprobar Node.js
  const nodeVersion = process.version;
  console.log(`[✓] Node.js instalado (${nodeVersion})`);

  // 2. Comprobar Configuración Global
  const globalPath = os.platform() === 'win32' && process.env.APPDATA
    ? path.join(process.env.APPDATA, 'ia-agent', 'config.json')
    : path.join(os.homedir(), '.config', 'ia-agent', 'config.json');

  if (fs.existsSync(globalPath)) {
    console.log(`[✓] Configuración global detectada (${globalPath})`);
  } else {
    console.log(`[!] Configuración global no encontrada. Se usarán valores por defecto.`);
  }

  // 3. Comprobar Variables y Secretos (Seguridad DevSecOps)
  try {
    const config = loadConfig();
    console.log(`[✓] Proveedor IA configurado: ${config.provider}`);
    console.log(`[✓] Modelo seleccionado: ${config.model}`);
    
    // Mostramos que existe la clave, pero NUNCA la imprimimos por pantalla
    const keyName = config.provider === 'gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY';
    console.log(`[✓] ${keyName} (Detectada y cargada correctamente en el entorno)`);
  } catch (error: any) {
    console.log(`[❌] Error de configuración: ${error.message}`);
    hasErrors = true;
  }

  // 4. Comprobar el Proyecto Actual
  const projectPath = process.cwd();
  const iaPath = path.join(projectPath, '.ia');
  
  if (fs.existsSync(iaPath)) {
    console.log(`[✓] Memoria del proyecto detectada en: ${iaPath}`);
    if (fs.existsSync(path.join(iaPath, 'rules.md'))) console.log(`    └─ rules.md encontrado`);
    if (fs.existsSync(path.join(iaPath, 'lessons.md'))) console.log(`    └─ lessons.md encontrado`);
  } else {
    console.log(`[!] No se ha detectado carpeta .ia/ en este proyecto (${projectPath})`);
    console.log(`    (El agente funcionará, pero no tendrá reglas específicas de este proyecto).`);
  }

  console.log("\n--------------------------------------------------");
  if (hasErrors) {
    console.log("⚠️  El diagnóstico ha encontrado problemas que debes solucionar.");
  } else {
    console.log("✅ Entorno saludable. ¡El agente está listo para trabajar!");
  }
};
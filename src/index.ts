import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { runAgentTask } from './engine/agent';

const getGlobalConfigPath = (): string => {
  if (os.platform() === 'win32' && process.env.APPDATA) {
    return path.join(process.env.APPDATA, 'ia-agent');
  }
  return path.join(os.homedir(), '.config', 'ia-agent');
};

const initGlobalEnv = () => {
  const globalPath = getGlobalConfigPath();
  if (!fs.existsSync(globalPath)) {
    fs.mkdirSync(globalPath, { recursive: true });
    fs.writeFileSync(
      path.join(globalPath, 'config.json'), 
      JSON.stringify({ defaultModel: "gpt-4o-mini", maxIter: 5 }, null, 2)
    );
  }
};

const main = async () => {
  console.log("🚀 Iniciando IA Agent Core...");
  initGlobalEnv();
  
  const targetProjectDir = process.cwd(); 
  
  // Aquí le damos nuestra primera tarea real al agente
  const userTask = "Usa la consola para listar los archivos de esta carpeta, luego lee el contenido de package.json y dime qué dependencias tiene instaladas.";
  
  console.log(`\n🎯 Tarea del usuario: "${userTask}"`);
  
  // Ejecutamos el agente (usamos await porque es asíncrono)
  await runAgentTask(userTask, targetProjectDir);
};

main();
#!/usr/bin/env node
import { runAgentTask } from './engine/agent';
import { runDoctor } from './cli/doctor';

const main = async () => {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log("❌ Error: Tienes que decirme qué hacer.");
    console.log("💡 Ejemplo: ia-agent \"crea un archivo llamado hola.txt\"");
    console.log("💡 Ejemplo: ia-agent doctor");
    process.exit(1);
  }

  const command = args[0].toLowerCase();

  // Si el usuario escribe "doctor", lanzamos el diagnóstico y salimos
  if (command === 'doctor') {
    runDoctor();
    return;
  }

  // Si no es "doctor", asumimos que es una tarea para la IA
  const userTask = args.join(" "); 
  const targetProjectDir = process.cwd(); 
  
  console.log("🚀 Iniciando IA Agent...");
  console.log(`🎯 Tarea: "${userTask}"`);
  
  await runAgentTask(userTask, targetProjectDir);
};

main();
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import { readProjectMemory } from '../memory/reader';
import { agentTools } from './toolsDefinition';
import { readFileTool, writeFileTool, runCommandTool } from '../tools';

dotenv.config();

// Inicializamos el cliente de Google AI
const ai = new GoogleGenAI({});

export const runAgentTask = async (task: string, projectPath: string) => {
  console.log("\n🧠 [Cerebro] Leyendo el contexto del proyecto...");
  const projectContext = readProjectMemory(projectPath);

  const systemPrompt = `Eres un agente de programación experto y autónomo.
Tu objetivo es resolver la tarea que te pide el usuario.

REGLAS DEL PROYECTO:
${projectContext}`;

  // Creamos una sesión de chat gestionada por Google que mantiene el historial automáticamente
  const chat = ai.chats.create({
    model: 'gemini-3.6-flash',
    config: {
      systemInstruction: systemPrompt,
      tools: agentTools,
    }
  });

  console.log("🤖 [Cerebro] Iniciando el bucle ReAct con Gemini...\n");

  let iteracion = 1;
  const maxIteraciones = 5;
  let userInput = task;

  while (iteracion <= maxIteraciones) {
    console.log(`\n⏳ [Iteración ${iteracion}] Enviando mensaje a Gemini...`);
    
    // Enviamos el mensaje o el resultado de la herramienta anterior al chat
    const response = await chat.sendMessage({ message: userInput });

    // Verificamos si Gemini quiere ejecutar alguna herramienta (Function Calling)
    const functionCalls = response.functionCalls;

    if (functionCalls && functionCalls.length > 0) {
      for (const call of functionCalls) {
        const functionName = call.name;
        const functionArgs = call.args as any;

        console.log(`⚙️ [Gemini Acción] Usando herramienta: ${functionName}`, functionArgs);

        let result = "";
        if (functionName === 'leer_archivo') {
          result = readFileTool(functionArgs.ruta);
        } else if (functionName === 'escribir_archivo') {
          result = writeFileTool(functionArgs.ruta, functionArgs.contenido);
        } else if (functionName === 'ejecutar_comando') {
          result = runCommandTool(functionArgs.comando);
        }

        console.log(`📄 [Observación] Resultado obtenido. Devolviendo a Gemini...`);

        // En la siguiente iteración le devolvemos el resultado de la función a Gemini como respuesta de herramienta
        userInput = `Resultado de la herramienta ${functionName}: ${result}`;
      }
    } else {
      // Si no hay llamadas a funciones, Gemini ha respondido con texto final
      console.log("\n✅ [Gemini Respuesta Final]:");
      console.log(response.text);
      break;
    }

    iteracion++;
  }

  if (iteracion > maxIteraciones) {
    console.log("\n⚠️ [Seguridad] Se alcanzó el límite de 5 iteraciones.");
  }
};
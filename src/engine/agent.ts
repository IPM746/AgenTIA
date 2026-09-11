// src/engine/agent.ts
import { loadConfig } from '../config/env';
import { createAIClient } from '../ai/factory';
import { Message } from '../ai/client';
import { agentTools } from './toolsDefinition';
import { readFileTool, writeFileTool, runCommandTool } from '../tools';
import { readProjectMemory } from '../memory/reader';

export const runAgentTask = async (task: string, projectPath: string) => {
  try {
    // 1. Cargamos la configuración segura (cero dependencias de dotenv)
    const config = loadConfig();
    console.log(`\n⚙️ [Config] Iniciando motor con proveedor: ${config.provider} (${config.model})`);

    // 2. Inicializamos el cliente de IA a través de la fábrica
    const ai = createAIClient(config.provider, config.apiKey, config.model);

    // 3. Cargamos la memoria local (las reglas y lecciones del proyecto)
    console.log("🧠 [Memoria] Leyendo contexto del proyecto (.ia/)...");
    const projectContext = readProjectMemory(projectPath);

    const systemPrompt = `Eres un agente de programación experto y autónomo.
Tu objetivo es resolver la tarea de forma eficiente.

IMPORTANTE - CONTEXTO DEL PROYECTO:
${projectContext}

PROCESO:
1. Usa las herramientas a tu disposición para investigar y modificar el código.
2. Cuando hayas terminado, escribe un breve resumen.`;

    // 4. Preparamos el historial de mensajes usando nuestra interfaz abstracta
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task }
    ];

    console.log("🤖 [Motor] Iniciando el bucle ReAct...\n");

    let iteracion = 1;
    const maxIteraciones = config.maxIter; // El límite ahora viene de config.json

    while (iteracion <= maxIteraciones) {
      console.log(`⏳ [Iteración ${iteracion}] Pensando...`);

      // 5. Llamamos a la IA (¡el motor no sabe si es Gemini, OpenAI o un modelo local!)
      const response = await ai.chat(messages, agentTools);
      const assistantText = response.text || `[Decidió usar herramientas]`;
      messages.push({ role: 'assistant', content: assistantText });
      messages.push({ role: 'assistant', content: response.text });

      // 6. Fase de Acción: Ejecución de herramientas
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const call of response.toolCalls) {
          const functionName = call.name;
          const functionArgs = call.args;

          console.log(`🛠️ [Acción] Usando herramienta: ${functionName}`, functionArgs);

          let result = "";
          // (En el próximo paso aplicaremos los guardrails aquí)
          if (functionName === 'leer_archivo') {
            result = readFileTool(functionArgs.ruta);
          } else if (functionName === 'escribir_archivo') {
            result = writeFileTool(functionArgs.ruta, functionArgs.contenido);
          } else if (functionName === 'ejecutar_comando') {
            result = runCommandTool(functionArgs.comando);
          }

          console.log(`📄 [Observación] Resultado devuelto al modelo.`);
          
          messages.push({
            role: 'tool',
            content: `Resultado de la herramienta ${functionName}: ${result}`,
            toolCallId: call.id
          });
        }
      } else {
        console.log("\n✅ [Respuesta Final]:");
        console.log(response.text);
        break; // Tarea terminada
      }

      iteracion++;
    }

    if (iteracion > maxIteraciones) {
      console.log(`\n⚠️ [Seguridad] Se alcanzó el límite estricto de ${maxIteraciones} iteraciones.`);
    }

  } catch (error: any) {
    console.error("\n❌ [Error Crítico]:", error.message);
  }
};
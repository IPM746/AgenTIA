// src/engine/agent.ts
import { loadConfig } from '../config/env';
import { createAIClient } from '../ai/factory';
import { Message } from '../ai/client';
import { agentTools } from './toolsDefinition';
import { readFileTool, writeFileTool, runCommandTool } from '../tools';
import { readProjectMemory } from '../memory/reader';

// --- NUEVO: Interfaz de eventos ---
export interface AgentCallbacks {
  onLog?: (message: string) => void;
  onStep?: (iteration: number) => void;
  onToolCall?: (toolName: string, args: Record<string, any>) => void;
  onToolResult?: (toolName: string, result: string) => void;
  onFinish?: (finalText: string, metrics?: any) => void;
  onError?: (error: Error) => void;
}

export const runAgentTask = async (
  task: string, 
  projectPath: string, 
  callbacks: AgentCallbacks = {} // Por defecto vacío para no romper nada
) => {
  const log = (msg: string) => callbacks.onLog && callbacks.onLog(msg);

  try {
    const config = loadConfig();
    log(`⚙️ [Config] Motor iniciado: ${config.provider} (${config.model})`);

    const ai = createAIClient(config.provider, config.apiKey, config.model);
    
    log("🧠 [Memoria] Leyendo contexto del proyecto (.ia/)...");
    const projectContext = readProjectMemory(projectPath);

    // ... (Tu system prompt y configuración de mensajes se mantienen igual)

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
      // ... dentro del while (iteracion <= maxIteraciones) ...
    
    callbacks.onStep && callbacks.onStep(iteracion);

    const response = await ai.chat(messages, agentTools);
    const assistantText = response.text || `[Decidió usar herramientas]`;
    messages.push({ role: 'assistant', content: assistantText });

    if (response.toolCalls && response.toolCalls.length > 0) {
      for (const call of response.toolCalls) {
        callbacks.onToolCall && callbacks.onToolCall(call.name, call.args);

        let result = "";
        // ... (ejecución de tu herramienta) ...
        
        callbacks.onToolResult && callbacks.onToolResult(call.name, "Completado");
        
        messages.push({
          role: 'tool',
          content: `Resultado de la herramienta ${call.name}: ${result}`,
          toolCallId: call.id
        });
      }
    } else {
      // Tarea finalizada
      callbacks.onFinish && callbacks.onFinish(response.text, response.usage);
      break; 
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
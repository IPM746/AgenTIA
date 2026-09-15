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

    const platformHint = process.platform === 'win32'
      ? '\nENTORNO: Estás ejecutándote en Windows. Usa comandos de PowerShell o CMD, no comandos Unix como ls.'
      : '';

    // 4. Preparamos el historial de mensajes usando nuestra interfaz abstracta
    const messages: Message[] = [
      { role: 'system', content: systemPrompt + platformHint },
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
    const responseText = response.text || '';
    if (responseText) {
      messages.push({ role: 'assistant', content: responseText });
    }

    if (response.toolCalls && response.toolCalls.length > 0) {
      for (const call of response.toolCalls) {
        console.log(`🔧 [Herramienta] ${call.name} ${JSON.stringify(call.args)}`);
        callbacks.onToolCall && callbacks.onToolCall(call.name, call.args);

        let result = "";
        try {
          const filePath = call.args.filePath || call.args.path || call.args.ruta;
          const content = call.args.content || call.args.contenido;
          const command = call.args.command || call.args.comando;

          if (call.name === 'readFileTool' || call.name === 'read_file' || call.name === 'leer_archivo') {
            result = readFileTool(filePath);
          } else if (call.name === 'writeFileTool' || call.name === 'write_file' || call.name === 'escribir_archivo') {
            result = writeFileTool(filePath, content);
          } else if (call.name === 'runCommandTool' || call.name === 'run_command' || call.name === 'ejecutar_comando') {
            result = runCommandTool(command);
          } else {
            result = `Error: Herramienta ${call.name} no reconocida por el motor.`;
          }
        } catch (error: any) {
          result = `Excepción al ejecutar ${call.name}: ${error.message}`;
        }
        
        console.log(`✅ [Resultado] ${result.substring(0, 300)}`);
        callbacks.onToolResult && callbacks.onToolResult(call.name, result);
        
        messages.push({
          role: 'tool',
          content: `Resultado de la herramienta ${call.name}: ${result}`,
          toolCallId: call.id
        });
      }
    } else if (!responseText.trim()) {
      console.log('⚠️ [Motor] El modelo no devolvió texto ni herramienta; solicitando que continúe.');
      messages.push({
        role: 'user',
        content: 'La respuesta anterior no produjo texto ni una herramienta. Continúa la tarea y usa una herramienta si todavía falta crear o revisar algo.'
      });
    } else {
      // Tarea finalizada
      console.log(`\n📝 [Respuesta final]\n${responseText}`);
      callbacks.onFinish && callbacks.onFinish(responseText, response.usage);
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
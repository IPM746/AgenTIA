
import { loadConfig } from "../config/env";
import { createAIClient } from "../ai/factory";
import { agentTools } from "./toolsDefinition";
import { readProjectMemory } from "../memory/reader";
import {
  readFileTool,
  writeFileTool,
  runCommandTool,
  searchFileTool,
} from "../tools/index";
import { AgentMetrics, calculateHistoryChars } from "./metrics";
import { Message } from "../ai/client";
import { optimizeContext } from "./context";

export interface AgentCallbacks {
  onLog?: (message: string) => void;
  onStep?: (iteration: number) => void;
  onToolCall?: (toolName: string, args: Record<string, any>) => void;
  onToolResult?: (toolName: string, result: string) => void;
  onFinish?: (finalText: string, metrics?: AgentMetrics) => void;
  onError?: (error: Error) => void;
}

export const runAgentTask = async (
  task: string,
  projectPath: string,
  callbacks: AgentCallbacks = {},
) => {
  const runStartedAt = performance.now();

  const metrics: AgentMetrics = {
    iterations: 0,
    toolCalls: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    isEstimated: false,
    iterationDetails: [],
    latencyMs: 0,
    result: "failure",
    errors: [],
  };

  const log = (msg: string) =>
    callbacks.onLog ? callbacks.onLog(msg) : console.log(msg);

  try {
    const config = loadConfig();

    log(
      `⚙️ [Config] Motor iniciado: ${config.provider} (${config.model})`,
    );

    const ai = createAIClient(
      config.provider,
      config.apiKey,
      config.model,
    );

    log("🧠 [Memoria] Leyendo contexto del proyecto (.ia/)...");

    const projectContext = readProjectMemory(projectPath);

    const systemPrompt = `Eres un agente de programación experto y autónomo.
Tu objetivo es resolver la tarea de forma eficiente.

IMPORTANTE - CONTEXTO DEL PROYECTO:
${projectContext}

PROCESO:
1. Usa las herramientas a tu disposición para investigar y modificar el código.
2. Cuando hayas terminado, escribe un breve resumen.`;

    const platformHint =
      process.platform === "win32"
        ? "\nENTORNO: Estás ejecutándote en Windows. Usa comandos de PowerShell o CMD, no comandos Unix como ls."
        : "";

    const messages: Message[] = [
      {
        role: "system",
        content: systemPrompt + platformHint,
      },
      {
        role: "user",
        content: task,
      },
    ];

    console.log("🤖 [Motor] Iniciando el bucle ReAct...\n");

    let iteracion = 1;
    const maxIteraciones = config.maxIter || 10;

    while (iteracion <= maxIteraciones) {
      console.log(`⏳ [Iteración ${iteracion}] Pensando...`);

      if (callbacks.onStep) {
        callbacks.onStep(iteracion);
      }

      // 1. Fotografía del contexto ANTES de enviar al LLM
      const historyMessagesCount = messages.length;
      const historyCharsCount = calculateHistoryChars(messages);

      // 2. Context Engine
      // Creamos una copia optimizada para enviar al LLM.
      // Mantiene las últimas 2 iteraciones completas y
      // trunca resultados antiguos > 1000 chars.
      const optimizedMessages = optimizeContext(messages, {
        maxRecentIterations: 2,
        truncateThreshold: 1000,
      });

      // 3. Medimos únicamente el tiempo de la llamada al proveedor.
      const iterationStartedAt = performance.now();

      const response = await ai.chat(
        optimizedMessages,
        agentTools,
      );

      const iterationLatencyMs =
        performance.now() - iterationStartedAt;

      const usage = response.usage;

      const currentPromptTokens =
        usage?.promptTokens ??
        Math.ceil(historyCharsCount / 4);

      const currentCompletionTokens =
        usage?.completionTokens ??
        Math.ceil((response.text?.length || 0) / 4);

      const currentTotalTokens =
        usage?.totalTokens ??
        currentPromptTokens + currentCompletionTokens;

      const isEstimated =
        usage?.estimated ?? usage === undefined;

      if (isEstimated) {
        metrics.isEstimated = true;
      }

      metrics.promptTokens += currentPromptTokens;
      metrics.completionTokens += currentCompletionTokens;
      metrics.totalTokens += currentTotalTokens;

      metrics.iterationDetails.push({
        iteration: iteracion,
        promptTokens: currentPromptTokens,
        completionTokens: currentCompletionTokens,
        totalTokens: currentTotalTokens,
        estimated: isEstimated,
        historyMessages: historyMessagesCount,
        historyChars: historyCharsCount,
        latencyMs: iterationLatencyMs,
      });

      const responseText = response.text || "";

      if (responseText || response.toolCalls?.length) {
        messages.push({
          role: "assistant",
          content: responseText,
          toolCalls: response.toolCalls,
        });
      }

      if (
        response.toolCalls &&
        response.toolCalls.length > 0
      ) {
        for (const call of response.toolCalls) {
          metrics.toolCalls++;

          if (callbacks.onToolCall) {
            callbacks.onToolCall(
              call.name,
              call.args,
            );
          }

          let result = "";

          try {
            const filePath =
              call.args.filePath ??
              call.args.path ??
              call.args.ruta;

            const content =
              call.args.content ??
              call.args.contenido;

            const command =
              call.args.command ??
              call.args.comando;

            const searchTerm =
              call.args.searchTerm ??
              call.args.termino;

            if (
              call.name === "readFileTool" ||
              call.name === "read_file" ||
              call.name === "leer_archivo"
            ) {
              result = readFileTool(filePath);
            } else if (
              call.name === "searchFileTool" ||
              call.name === "buscar_archivo"
            ) {
              result = searchFileTool(
                filePath,
                searchTerm,
              );
            } else if (
              call.name === "writeFileTool" ||
              call.name === "write_file" ||
              call.name === "escribir_archivo"
            ) {
              result = writeFileTool(
                filePath,
                content,
              );
            } else if (
              call.name === "runCommandTool" ||
              call.name === "run_command" ||
              call.name === "ejecutar_comando"
            ) {
              result = runCommandTool(command);
            } else {
              result =
                `Error: Herramienta ${call.name} no reconocida por el motor.`;
            }
          } catch (e: any) {
            result =
              `Excepción al ejecutar ${call.name}: ${e.message}`;
          }

          if (callbacks.onToolResult) {
            callbacks.onToolResult(
              call.name,
              result,
            );
          }

          messages.push({
            role: "tool",
            content: result,
            toolCallId: call.id,
            toolName: call.name,
          });
        }
      } else if (!responseText.trim()) {
        console.log(
          "⚠️ [Motor] El modelo no devolvió texto ni herramienta; solicitando que continúe.",
        );

        messages.push({
          role: "user",
          content:
            "La respuesta anterior no produjo texto ni una herramienta. Continúa la tarea y usa una herramienta si todavía falta crear o revisar algo.",
        });
      } else {
        metrics.iterations = iteracion;

        metrics.latencyMs =
          performance.now() - runStartedAt;

        metrics.result = "success";

        console.log(`\n📊 [Métricas - Baseline]`);

        console.log(
          `Origen datos: ${
            metrics.isEstimated
              ? "Estimación local o mixta"
              : "Tokens reales del proveedor"
          }`,
        );

        console.log(
          `Iteraciones: ${metrics.iterations}`,
        );

        console.log(
          `Tool calls: ${metrics.toolCalls}`,
        );

        console.log(
          `Input tokens (acumulados): ${metrics.promptTokens}`,
        );

        console.log(
          `Output tokens (acumulados): ${metrics.completionTokens}`,
        );

        console.log(
          `Total tokens: ${metrics.totalTokens}`,
        );

        console.log(
          `Latencia total: ${metrics.latencyMs.toFixed(0)} ms`,
        );

        console.log("\n📈 [Crecimiento del contexto por iteración]");

        metrics.iterationDetails.forEach((det) => {
          console.log(
            `Iteración ${det.iteration} → input: ${det.promptTokens} | output: ${det.completionTokens} | historial: ${det.historyMessages} msgs (~${det.historyChars} chars) | latencia: ${det.latencyMs.toFixed(0)} ms`,
          );
        });

        console.log("");

        if (callbacks.onFinish) {
          callbacks.onFinish(
            responseText,
            metrics,
          );
        }

        break;
      }

      iteracion++;
    }

    if (iteracion > maxIteraciones) {
      metrics.iterations = maxIteraciones;

      metrics.latencyMs =
        performance.now() - runStartedAt;

      metrics.result = "max_iterations";

      console.log(
        `\n⚠️ [Seguridad] Se alcanzó el límite estricto de ${maxIteraciones} iteraciones.`,
      );

      if (callbacks.onFinish) {
        callbacks.onFinish(
          "Límite de iteraciones alcanzado.",
          metrics,
        );
      }
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    metrics.latencyMs =
      performance.now() - runStartedAt;

    metrics.result = "failure";
    metrics.errors.push(message);

    console.error(
      "\n❌ [Error Crítico]:",
      message,
    );

    const normalizedError =
      error instanceof Error
        ? error
        : new Error(message);

    if (callbacks.onError) {
      callbacks.onError(normalizedError);
    }

    if (callbacks.onFinish) {
      callbacks.onFinish("", metrics);
    }
  }
}


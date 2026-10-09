import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LLMClient, LLMResponse, Message } from '../src/ai/client';
import { AgentConfig } from '../src/config/env';
import { runAgentTask } from '../src/engine/agent';
import { ToolRegistry } from '../src/tools/registry';
import { Tool, ToolExecutionResult } from '../src/tools/types';

class ScriptedClient implements LLMClient {
  readonly receivedMessages: Message[][] = [];

  constructor(private readonly responses: LLMResponse[]) {}

  async chat(messages: Message[]): Promise<LLMResponse> {
    this.receivedMessages.push(messages.map((message) => ({ ...message })));
    const response = this.responses.shift();
    if (!response) {
      throw new Error('El cliente de prueba recibió más llamadas de las esperadas.');
    }
    return response;
  }
}

const config: AgentConfig = {
  provider: 'test',
  model: 'test-model',
  apiKey: '',
  maxIter: 6,
  verificationMaxCycles: 2,
};

const successfulWrite = (output: string): ToolExecutionResult => ({
  output,
  success: true,
  status: 'success',
});

const createRegistry = (
  workspacePath: string,
  verificationResults: ToolExecutionResult[],
  verificationCommands: string[],
): ToolRegistry => {
  const registry = new ToolRegistry();
  const writeTool: Tool = {
    name: 'escribir_archivo',
    description: 'Writes a test file.',
    permissions: ['filesystem.write'],
    pathArguments: ['ruta'],
    inputSchema: {
      type: 'object',
      properties: {
        ruta: { type: 'string' },
        contenido: { type: 'string' },
      },
      required: ['ruta', 'contenido'],
      additionalProperties: false,
    },
    execute: (args) => {
      const target = path.join(workspacePath, args.ruta as string);
      fs.writeFileSync(target, args.contenido as string, 'utf-8');
      return successfulWrite(`Archivo guardado: ${args.ruta}`);
    },
  };
  const commandTool: Tool = {
    name: 'ejecutar_comando',
    description: 'Returns controlled verification results.',
    permissions: ['process.execute'],
    lexicalArguments: ['comando'],
    inputSchema: {
      type: 'object',
      properties: { comando: { type: 'string' } },
      required: ['comando'],
      additionalProperties: false,
    },
    execute: (args) => {
      verificationCommands.push(args.comando as string);
      const result = verificationResults.shift();
      if (!result) {
        throw new Error('Falta un resultado de verificación de prueba.');
      }
      return result;
    },
  };
  registry.register(writeTool);
  registry.register(commandTool);
  return registry;
};

const runTests = async () => {
  const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'agentia-agent-verification-'));

  try {
    const repairCommands: string[] = [];
    const repairClient = new ScriptedClient([
      {
        text: '',
        toolCalls: [{ id: 'write-1', name: 'escribir_archivo', args: { ruta: 'result.txt', contenido: 'broken' } }],
      },
      { text: 'La implementación inicial está terminada.' },
      {
        text: '',
        toolCalls: [{ id: 'write-2', name: 'escribir_archivo', args: { ruta: 'result.txt', contenido: 'repaired' } }],
      },
      { text: 'La reparación está terminada.' },
    ]);
    const repairedRun = await runAgentTask(
      'Corrige result.txt.',
      workspacePath,
      { onLog: () => undefined },
      {
        config,
        ai: repairClient,
        toolRegistry: createRegistry(workspacePath, [
          { output: 'test failure', success: false, status: 'operation_failed', exitCode: 1, stderr: 'expected repaired' },
          { output: 'tests passed', success: true, status: 'success', exitCode: 0 },
        ], repairCommands),
        verificationCommands: ['npm test'],
      },
    );
    assert.strictEqual(repairedRun.metrics.result, 'success');
    assert.strictEqual(repairedRun.metrics.verificationStatus, 'passed');
    assert.strictEqual(repairedRun.metrics.verificationAttempts.length, 2);
    assert.deepStrictEqual(repairCommands, ['npm test', 'npm test']);
    assert.strictEqual(fs.readFileSync(path.join(workspacePath, 'result.txt'), 'utf-8'), 'repaired');
    assert.ok(repairClient.receivedMessages[2].some((message) =>
      message.source === 'external_data' && message.content.includes('test failure'),
    ));
    assert.ok(repairClient.receivedMessages[2].some((message) =>
      message.source === 'internal' && message.content.includes('La verificación falló'),
    ));

    const failedCommands: string[] = [];
    const failedRun = await runAgentTask(
      'Haz un cambio que no se puede verificar.',
      workspacePath,
      { onLog: () => undefined },
      {
        config: { ...config, verificationMaxCycles: 1 },
        ai: new ScriptedClient([
          {
            text: '',
            toolCalls: [{ id: 'write-failure', name: 'escribir_archivo', args: { ruta: 'failed.txt', contenido: 'change' } }],
          },
          { text: 'Terminado.' },
        ]),
        toolRegistry: createRegistry(workspacePath, [
          { output: 'tests still fail', success: false, status: 'operation_failed', exitCode: 1 },
        ], failedCommands),
        verificationCommands: ['npm test'],
      },
    );
    assert.strictEqual(failedRun.metrics.result, 'failure');
    assert.strictEqual(failedRun.metrics.verificationStatus, 'failed');
    assert.strictEqual(failedRun.finalText, 'La verificación no se completó correctamente.');
    assert.strictEqual(failedRun.metrics.verificationAttempts.length, 1);
    assert.deepStrictEqual(failedCommands, ['npm test']);

    const readOnlyCommands: string[] = [];
    const readOnlyRun = await runAgentTask(
      'Revisa el proyecto sin modificarlo.',
      workspacePath,
      { onLog: () => undefined },
      {
        config,
        ai: new ScriptedClient([{ text: 'La revisión no requiere cambios.' }]),
        toolRegistry: createRegistry(workspacePath, [], readOnlyCommands),
        verificationCommands: ['npm test'],
      },
    );
    assert.strictEqual(readOnlyRun.metrics.result, 'success');
    assert.strictEqual(readOnlyRun.metrics.verificationStatus, 'not_needed');
    assert.strictEqual(readOnlyRun.metrics.verificationAttempts.length, 0);
    assert.deepStrictEqual(readOnlyCommands, []);

    console.log('Integración de verificación del agente superada.');
  } finally {
    fs.rmSync(workspacePath, { recursive: true, force: true });
  }
};

void runTests();

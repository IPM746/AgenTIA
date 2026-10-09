#!/usr/bin/env node
import { AgentMode, getAgentExitCode, runAgentTask } from './engine/agent';
import { runDoctor } from './cli/doctor';
import { initializeProjectKnowledge } from './memory/projectInit';

interface CliTask {
  task: string;
  mode: AgentMode;
}

const usage = (): void => {
  console.log('Uso: ia-agent [--mode read-only|edit] "tarea"');
  console.log('     ia-agent doctor');
  console.log('     ia-agent init');
};

export const parseCliTask = (args: readonly string[]): CliTask | undefined => {
  const taskParts: string[] = [];
  let mode: AgentMode = 'edit';

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--mode') {
      const value = args[++index];
      if (value === 'read-only') {
        mode = 'read_only';
        continue;
      }
      if (value === 'edit') {
        mode = 'edit';
        continue;
      }
      return undefined;
    }
    taskParts.push(arg);
  }

  const task = taskParts.join(' ').trim();
  return task ? { task, mode } : undefined;
};

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);

  if (args.length === 1 && args[0].toLowerCase() === 'doctor') {
    process.exitCode = runDoctor() ? 0 : 1;
    return;
  }

  if (args.length === 1 && args[0].toLowerCase() === 'init') {
    const result = initializeProjectKnowledge(process.cwd());
    console.log(`ProjectKnowledge inicializado en ${process.cwd()}.`);
    if (result.created.length) {
      console.log(`Archivos creados: ${result.created.join(', ')}`);
    }
    if (result.existing.length) {
      console.log(`Archivos conservados: ${result.existing.join(', ')}`);
    }
    return;
  }

  const parsed = parseCliTask(args);
  if (!parsed) {
    console.log('Error: Debes indicar una tarea y un modo válido.');
    usage();
    process.exitCode = 1;
    return;
  }

  const targetProjectDir = process.cwd();
  console.log('Iniciando AgenTIA...');
  console.log(`Modo: ${parsed.mode === 'read_only' ? 'solo lectura' : 'edición'}`);
  console.log(`Tarea: "${parsed.task}"`);

  const result = await runAgentTask(parsed.task, targetProjectDir, {
    onFinish: (finalText) => {
      if (finalText) {
        console.log(`\nResultado:\n${finalText}`);
      }
    },
  }, { mode: parsed.mode });

  if (result.metrics.verificationStatus === 'unavailable') {
    console.warn('Aviso: hubo cambios, pero el proyecto no tiene comprobaciones automáticas disponibles.');
  }

  console.log(`Estado de verificación: ${result.metrics.verificationStatus}`);

  process.exitCode = getAgentExitCode(result);
};

if (require.main === module) {
  void main();
}

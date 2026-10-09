/* import * as path from 'path';
import { AgentRunOptions, AgentRunResult, runAgentTask } from './agent';
import { ToolPermission } from '../tools/types';

export type AgentMode = 'read_only' | 'write';

export interface ManagedAgentTask {
  id: string;
  task: string;
  workspacePath: string;
  mode?: AgentMode;
}

export interface ManagedAgentResult {
  id: string;
  mode: AgentMode;
  result: AgentRunResult;
}

export interface AgentRunner {
  run(task: string, workspacePath: string, options: AgentRunOptions): Promise<AgentRunResult>;
}

export interface AgentManagerOptions {
  maxParallel?: number;
}

const permissionsForMode = (mode: AgentMode): readonly ToolPermission[] =>
  mode === 'write'
    ? ['filesystem.read', 'filesystem.write', 'process.execute']
    : ['filesystem.read'];

const defaultRunner: AgentRunner = {
  run: (task, workspacePath, options) => runAgentTask(task, workspacePath, {}, options),
};

export class AgentManager {
  private readonly maxParallel: number;

  constructor(
    private readonly runner: AgentRunner = defaultRunner,
    options: AgentManagerOptions = {},
  ) {
    this.maxParallel = Number.isFinite(options.maxParallel) && (options.maxParallel ?? 0) > 0
      ? Math.floor(options.maxParallel!)
      : 3;
  }

  async runParallel(tasks: readonly ManagedAgentTask[]): Promise<ManagedAgentResult[]> {
    const ids = new Set<string>();
    const writersByWorkspace = new Map<string, number>();

    for (const task of tasks) {
      if (!task.id || !task.task.trim()) {
        throw new Error('Cada agente necesita id y tarea.');
      }
      if (ids.has(task.id)) {
        throw new Error(`El id de agente '${task.id}' está duplicado.`);
      }
      ids.add(task.id);

      if ((task.mode ?? 'read_only') === 'write') {
        const workspace = path.resolve(task.workspacePath);
        writersByWorkspace.set(workspace, (writersByWorkspace.get(workspace) ?? 0) + 1);
      }
    }

    for (const [workspace, writerCount] of writersByWorkspace) {
      if (writerCount > 1) {
        throw new Error(`No se permiten varios agentes escritores en paralelo para ${workspace}.`);
      }
    }

    const results: ManagedAgentResult[] = new Array(tasks.length);
    let nextIndex = 0;
    const workerCount = Math.min(this.maxParallel, tasks.length);

    const runWorker = async (): Promise<void> => {
      while (nextIndex < tasks.length) {
        const index = nextIndex++;
        const task = tasks[index];
        const mode = task.mode ?? 'read_only';
        const result = await this.runner.run(task.task, task.workspacePath, {
          agentId: task.id,
          allowedPermissions: permissionsForMode(mode),
        });
        results[index] = { id: task.id, mode, result };
      }
    };

    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
    return results;
  }
}
  */

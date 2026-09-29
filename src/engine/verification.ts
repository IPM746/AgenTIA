import * as fs from 'fs';
import * as path from 'path';
import { ToolExecutor } from '../tools/executor';
import { Tool, ToolContext } from '../tools/types';

export interface VerificationAttempt {
  cycle: number;
  command: string;
  result: string;
  passed: boolean;
  error?: string;
}

export interface VerificationResult {
  cycle: number;
  passed: boolean;
  canRepair: boolean;
  exhausted: boolean;
  attempts: readonly VerificationAttempt[];
}

export interface VerificationLoopOptions {
  commands: readonly string[];
  maxCycles?: number;
}

const DEFAULT_MAX_CYCLES = 3;

const commandFailed = (result: string): boolean =>
  result.startsWith('Error:') || result.startsWith('Excepción al ejecutar');

export const getVerificationCommands = (workspacePath: string): string[] => {
  const packagePath = path.join(workspacePath, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return [];
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8')) as {
      scripts?: Record<string, unknown>;
    };
    const scripts = packageJson.scripts ?? {};
    const commands: string[] = [];

    if (typeof scripts.test === 'string') commands.push('npm test');
    if (typeof scripts.typecheck === 'string') commands.push('npm run typecheck');
    if (typeof scripts.build === 'string') commands.push('npm run build');

    return commands;
  } catch {
    return [];
  }
};

/**
 * Runs a bounded verification pass. Repair is deliberately owned by the agent
 * loop, so this class cannot recursively invoke itself.
 */
export class VerificationLoop {
  private readonly maxCycles: number;
  private readonly commands: readonly string[];
  private completedCycles = 0;
  private readonly attempts: VerificationAttempt[] = [];

  constructor(
    private readonly executor: ToolExecutor,
    private readonly commandTool: Tool,
    private readonly context: ToolContext,
    options: VerificationLoopOptions,
  ) {
    this.maxCycles = Number.isFinite(options.maxCycles) && (options.maxCycles ?? 0) > 0
      ? Math.floor(options.maxCycles!)
      : DEFAULT_MAX_CYCLES;
    this.commands = [...options.commands];
  }

  async verify(): Promise<VerificationResult> {
    if (this.completedCycles >= this.maxCycles) {
      return {
        cycle: this.completedCycles,
        passed: false,
        canRepair: false,
        exhausted: true,
        attempts: [],
      };
    }

    this.completedCycles++;
    const cycle = this.completedCycles;
    const cycleAttempts: VerificationAttempt[] = [];

    for (const command of this.commands) {
      const result = await this.executor.execute(
        this.commandTool,
        { comando: command },
        this.context,
      );
      const passed = !commandFailed(result);
      const attempt: VerificationAttempt = {
        cycle,
        command,
        result,
        passed,
        ...(passed ? {} : { error: result }),
      };
      this.attempts.push(attempt);
      cycleAttempts.push(attempt);

      if (!passed) {
        return {
          cycle,
          passed: false,
          canRepair: cycle < this.maxCycles,
          exhausted: cycle >= this.maxCycles,
          attempts: cycleAttempts,
        };
      }
    }

    return {
      cycle,
      passed: true,
      canRepair: false,
      exhausted: false,
      attempts: cycleAttempts,
    };
  }

  getAttempts(): readonly VerificationAttempt[] {
    return [...this.attempts];
  }
}

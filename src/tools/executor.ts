import { Tool, ToolContext, ToolExecutionResult } from './types';
import { SecurityPolicy } from './securityPolicy';
import { validateArguments } from './security/argumentValidator';
import { analyzeToolArguments } from './security/lexicalAnalyzer';
import { resolveWorkspacePath } from './security/workspaceGuard';

export class ToolExecutor {
  constructor(private readonly securityPolicy = new SecurityPolicy()) {}

  async execute(
    tool: Tool,
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<string> {
    const result = await this.executeDetailed(tool, args, context);
    return result.output;
  }

  async executeDetailed(
    tool: Tool,
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolExecutionResult> {
    const validation = validateArguments(args, tool.inputSchema);
    if (!validation.valid) {
      return {
        output: `Error: Argumentos inválidos para ${tool.name}: ${validation.errors.join(' ')}`,
        success: false,
      };
    }

    const permissionDecision = this.securityPolicy.check(tool, context);
    if (!permissionDecision.allowed) {
      return {
        output: `Error: Herramienta ${tool.name} bloqueada por política de seguridad: ${permissionDecision.reason}.`,
        success: false,
      };
    }

    if (tool.permissions?.some((permission) => permission.startsWith('filesystem.'))) {
      if (!tool.pathArguments?.length) {
        return {
          output: `Error: Herramienta ${tool.name} no declara los argumentos de ruta requeridos por el Security Gate.`,
          success: false,
        };
      }

      for (const argumentName of tool.pathArguments) {
        const pathArgument = args[argumentName];
        if (typeof pathArgument !== 'string') {
          return {
            output: `Error: Argumento de ruta inválido para ${tool.name}: ${argumentName}.`,
            success: false,
          };
        }

        try {
          resolveWorkspacePath(pathArgument, context);
        } catch (error: unknown) {
          return {
            output: error instanceof Error ? error.message : String(error),
            success: false,
          };
        }
      }
    }

    const lexicalResult = analyzeToolArguments(tool, args);
    const decision = this.securityPolicy.check(
      tool,
      context,
      lexicalResult.risk,
    );
    if (!decision.allowed) {
      const action = decision.requiresConfirmation
        ? 'requiere confirmación'
        : 'bloqueada';
      return {
        output: `Error: Herramienta ${tool.name} ${action} por política de seguridad: ${decision.reason}.`,
        success: false,
      };
    }

    try {
      const execution = await tool.execute(args, context);
      return typeof execution === 'string'
        ? { output: execution, success: true }
        : execution;
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      return {
        output: `Excepción al ejecutar ${tool.name}: ${message}`,
        success: false,
      };
    }
  }
}

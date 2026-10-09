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
        status: 'validation_error',
        error: validation.errors.join(' '),
      };
    }

    const permissionDecision = this.securityPolicy.check(tool, context);
    if (!permissionDecision.allowed) {
      return {
        output: `Error: Herramienta ${tool.name} bloqueada por política de seguridad: ${permissionDecision.reason}.`,
        success: false,
        status: 'permission_denied',
        error: permissionDecision.reason,
      };
    }

    if (tool.permissions?.some((permission) => permission.startsWith('filesystem.'))) {
      if (!tool.pathArguments?.length) {
        return {
          output: `Error: Herramienta ${tool.name} no declara los argumentos de ruta requeridos por el Security Gate.`,
          success: false,
          status: 'validation_error',
        };
      }

      for (const argumentName of tool.pathArguments) {
        const pathArgument = args[argumentName];
        if (typeof pathArgument !== 'string') {
          return {
            output: `Error: Argumento de ruta inválido para ${tool.name}: ${argumentName}.`,
            success: false,
            status: 'validation_error',
          };
        }

        try {
          resolveWorkspacePath(pathArgument, context);
        } catch (error: unknown) {
          return {
            output: error instanceof Error ? error.message : String(error),
            success: false,
            status: 'path_denied',
            error: error instanceof Error ? error.message : String(error),
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
        status: 'blocked',
        error: decision.reason,
      };
    }

    try {
      const execution = await tool.execute(args, context);
      return execution;
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      return {
        output: `Excepción al ejecutar ${tool.name}: ${message}`,
        success: false,
        status: 'exception',
        error: message,
      };
    }
  }
}

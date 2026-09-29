import { Tool, ToolContext } from './types';
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
    const validation = validateArguments(args, tool.inputSchema);
    if (!validation.valid) {
      return `Error: Argumentos inválidos para ${tool.name}: ${validation.errors.join(' ')}`;
    }

    const permissionDecision = this.securityPolicy.check(tool, context);
    if (!permissionDecision.allowed) {
      return `Error: Herramienta ${tool.name} bloqueada por política de seguridad: ${permissionDecision.reason}.`;
    }

    if (tool.permissions?.some((permission) => permission.startsWith('filesystem.'))) {
      if (!tool.pathArguments?.length) {
        return `Error: Herramienta ${tool.name} no declara los argumentos de ruta requeridos por el Security Gate.`;
      }

      for (const argumentName of tool.pathArguments) {
        const pathArgument = args[argumentName];
        if (typeof pathArgument !== 'string') {
          return `Error: Argumento de ruta inválido para ${tool.name}: ${argumentName}.`;
        }

        try {
          resolveWorkspacePath(pathArgument, context);
        } catch (error: unknown) {
          return error instanceof Error ? error.message : String(error);
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
      return `Error: Herramienta ${tool.name} ${action} por política de seguridad: ${decision.reason}.`;
    }

    try {
      return await tool.execute(args, context);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      return `Excepción al ejecutar ${tool.name}: ${message}`;
    }
  }
}

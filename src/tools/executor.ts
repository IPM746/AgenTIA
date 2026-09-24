import { Tool, ToolContext } from './types';
import { SecurityPolicy } from './securityPolicy';

export class ToolExecutor {
  constructor(private readonly securityPolicy = new SecurityPolicy()) {}

  async execute(
    tool: Tool,
    args: Record<string, unknown>,
    context: ToolContext,
  ): Promise<string> {
    const decision = this.securityPolicy.check(tool, context);
    if (!decision.allowed) {
      return `Error: Herramienta ${tool.name} bloqueada por política de seguridad: ${decision.reason}.`;
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

import { Tool, ToolContext } from './types';

export class ToolExecutor {
  async execute(
    tool: Tool,
    args: Record<string, any>,
    context: ToolContext,
  ): Promise<string> {
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

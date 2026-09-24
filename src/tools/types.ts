export interface ToolContext {
  workspacePath: string;
}

export interface Tool {
  name: string;
  aliases?: string[];
  execute(
    args: Record<string, any>,
    context: ToolContext,
  ): string | Promise<string>;
}

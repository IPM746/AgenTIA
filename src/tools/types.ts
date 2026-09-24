export interface JsonSchema {
  type: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
}

export interface ToolContext {
  workspacePath: string;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  aliases?: string[];
  execute(
    args: Record<string, unknown>,
    context: ToolContext,
  ): string | Promise<string>;
}

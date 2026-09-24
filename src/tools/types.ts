export type JsonSchemaPrimitive = string | number | boolean | null;
export type ToolPermission =
  | 'filesystem.read'
  | 'filesystem.write'
  | 'process.execute'
  | 'network.request'
  | 'git.read'
  | 'git.write'
  | 'memory.write';

export interface JsonSchema {
  type: string | string[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: JsonSchemaPrimitive[];
  additionalProperties?: boolean | JsonSchema;
}

export interface ToolContext {
  workspacePath: string;
  allowedPermissions?: readonly ToolPermission[];
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  aliases?: string[];
  permissions?: readonly ToolPermission[];
  execute(
    args: Record<string, unknown>,
    context: ToolContext,
  ): string | Promise<string>;
}

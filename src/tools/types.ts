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

export interface ToolExecutionResult {
  output: string;
  success: boolean;
  status: ToolExecutionStatus;
  error?: string;
  exitCode?: number;
  signal?: string;
  stdout?: string;
  stderr?: string;
}

export type ToolExecutionStatus =
  | 'success'
  | 'validation_error'
  | 'permission_denied'
  | 'path_denied'
  | 'blocked'
  | 'operation_failed'
  | 'timeout'
  | 'signal'
  | 'exception';

export interface Tool {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  aliases?: string[];
  permissions?: readonly ToolPermission[];
  /** Argument names that contain workspace-relative filesystem paths. */
  pathArguments?: readonly string[];
  lexicalArguments?: readonly string[];
  execute(
    args: Record<string, unknown>,
    context: ToolContext,
  ): ToolExecutionResult | Promise<ToolExecutionResult>;
}

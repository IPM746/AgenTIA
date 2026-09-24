import { Tool, ToolContext } from './types';

export interface SecurityDecision {
  allowed: boolean;
  reason?: string;
}

export class SecurityPolicy {
  check(tool: Tool, context: ToolContext): SecurityDecision {
    if (!context.allowedPermissions) {
      return { allowed: true };
    }

    const denied = (tool.permissions ?? []).find(
      (permission) => !context.allowedPermissions!.includes(permission),
    );

    return denied
      ? {
          allowed: false,
          reason: `requiere el permiso '${denied}'`,
        }
      : { allowed: true };
  }
}

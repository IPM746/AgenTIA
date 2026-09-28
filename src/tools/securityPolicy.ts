import { LexicalRisk } from './security/lexicalAnalyzer';
import { Tool, ToolContext, ToolPermission } from './types';

export interface SecurityDecision {
  allowed: boolean;
  requiresConfirmation: boolean;
  risk: LexicalRisk;
  reason?: string;
}

export class SecurityPolicy {
  private readonly defaultPermissions: readonly ToolPermission[] = [
    'filesystem.read',
  ];

  check(
    tool: Tool,
    context: ToolContext,
    risk: LexicalRisk = 'low',
  ): SecurityDecision {
    if (risk === 'high') {
      return {
        allowed: false,
        requiresConfirmation: false,
        risk,
        reason: 'se detectó una operación de alto riesgo',
      };
    }

    if (risk === 'medium') {
      return {
        allowed: false,
        requiresConfirmation: true,
        risk,
        reason: 'requiere confirmación humana por señales de riesgo medio',
      };
    }

    const allowedPermissions =
      context.allowedPermissions ?? this.defaultPermissions;

    const denied = (tool.permissions ?? []).find(
      (permission) => !allowedPermissions.includes(permission),
    );

    return denied
      ? {
          allowed: false,
          requiresConfirmation: false,
          risk,
          reason: `requiere el permiso '${denied}'`,
        }
      : { allowed: true, requiresConfirmation: false, risk };
  }
}

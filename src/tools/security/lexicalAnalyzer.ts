import { Tool } from '../types';

export type LexicalRisk = 'low' | 'medium' | 'high';

export interface LexicalSecurityResult {
  risk: LexicalRisk;
  matches: string[];
  reason?: string;
}

const highRiskPatterns: Array<[string, RegExp]> = [
  ['borrado recursivo', /(?:^|[;&|]\s*)(?:rm\s+-[a-z]*r|rmdir(?:\s+\/s)?|rd\s+\/s|remove-item\s+.*-recurse|del\s+\/s)\b/i],
  ['formateo de disco', /(?:^|[;&|]\s*)format\b/i],
  ['cambio de permisos', /(?:icacls|takeown|chmod\s+(?:-r\s+)?(?:777|a\+w))/i],
  ['script descargado y ejecutado', /(?:invoke-webrequest|curl|wget).*(?:\||;|&&).*?(?:iex|invoke-expression|sh|bash|powershell)/i],
  ['PowerShell codificado', /powershell(?:\.exe)?\s+.*-(?:enc|encodedcommand)\b/i],
];

const mediumRiskPatterns: Array<[string, RegExp]> = [
  ['comandos encadenados', /(?:&&|\|\||(?<!\|)\|(?!\|)|;|&)/],
  ['shell secundaria', /\b(?:cmd\s+\/c|powershell(?:\.exe)?\s+-command)\b/i],
  ['salida del workspace', /(?:\.\.\\|\.\.\/)/],
];

export const analyzeToolArguments = (
  tool: Tool,
  args: Record<string, unknown>,
): LexicalSecurityResult => {
  const text = Object.values(args)
    .filter((value): value is string => typeof value === 'string')
    .join('\n');

  if (!text || !tool.permissions?.some((permission) =>
    permission === 'process.execute' || permission === 'filesystem.write',
  )) {
    return { risk: 'low', matches: [] };
  }

  const highMatches = highRiskPatterns
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name);
  if (highMatches.length) {
    return { risk: 'high', matches: highMatches, reason: highMatches.join(', ') };
  }

  const mediumMatches = mediumRiskPatterns
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name);
  return mediumMatches.length
    ? { risk: 'medium', matches: mediumMatches, reason: mediumMatches.join(', ') }
    : { risk: 'low', matches: [] };
};

import * as fs from 'fs';
import * as path from 'path';
import { ToolContext } from '../types';

export const resolveWorkspacePath = (
  targetPath: string,
  context: ToolContext,
): string => {
  const workspaceRoot = path.resolve(context.workspacePath);
  const absolutePath = path.resolve(workspaceRoot, targetPath);
  const relativePath = path.relative(workspaceRoot, absolutePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`[Seguridad] Bloqueado: Intento de acceso fuera de los límites del proyecto (${targetPath})`);
  }

  let existingPath = absolutePath;
  while (!fs.existsSync(existingPath)) {
    const parent = path.dirname(existingPath);
    if (parent === existingPath) break;
    existingPath = parent;
  }

  if (fs.existsSync(existingPath)) {
    const realWorkspace = fs.realpathSync(workspaceRoot);
    const realPath = fs.realpathSync(existingPath);
    const realRelative = path.relative(realWorkspace, realPath);
    if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
      throw new Error('[Seguridad] Bloqueado: El enlace simbólico apunta fuera del proyecto.');
    }
  }

  return absolutePath;
};

import * as fs from 'fs';
import * as path from 'path';
import { ToolContext } from '../types';

const isOutside = (rootPath: string, candidatePath: string): boolean => {
  const relativePath = path.relative(rootPath, candidatePath);
  return relativePath === '..'
    || relativePath.startsWith(`..${path.sep}`)
    || path.isAbsolute(relativePath);
};

const findFirstExistingPath = (targetPath: string): string => {
  let currentPath = targetPath;

  while (true) {
    try {
      // lstat also sees dangling symbolic links, which existsSync deliberately hides.
      fs.lstatSync(currentPath);
      return currentPath;
    } catch (error) {
      const errorCode = (error as NodeJS.ErrnoException).code;
      if (errorCode !== 'ENOENT') {
        throw error;
      }

      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) {
        throw new Error('[Seguridad] Bloqueado: No se ha encontrado un directorio base válido.');
      }
      currentPath = parentPath;
    }
  }
};

export const resolveWorkspacePath = (
  targetPath: string,
  context: ToolContext,
): string => {
  const workspaceRoot = path.resolve(context.workspacePath);
  const absolutePath = path.resolve(workspaceRoot, targetPath);

  if (isOutside(workspaceRoot, absolutePath)) {
    throw new Error(`[Seguridad] Bloqueado: Intento de acceso fuera de los límites del proyecto (${targetPath})`);
  }

  let realWorkspace: string;
  try {
    realWorkspace = fs.realpathSync(workspaceRoot);
  } catch (error) {
    throw new Error('[Seguridad] Bloqueado: El workspace no apunta a un directorio existente.');
  }

  const existingPath = findFirstExistingPath(absolutePath);
  let realExistingPath: string;
  try {
    realExistingPath = fs.realpathSync(existingPath);
  } catch (error) {
    const errorCode = (error as NodeJS.ErrnoException).code;
    if (errorCode === 'ENOENT') {
      throw new Error('[Seguridad] Bloqueado: El enlace simbólico no tiene un destino válido.');
    }
    throw error;
  }

  if (isOutside(realWorkspace, realExistingPath)) {
    throw new Error('[Seguridad] Bloqueado: El enlace simbólico apunta fuera del proyecto.');
  }

  return absolutePath;
};

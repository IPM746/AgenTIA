// src/tools/index.ts
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * 🛡️ CAPA DE RESTRICCIÓN DE ARCHIVOS
 * Importante: Esto previene path traversal básico y protege secretos conocidos,
 * pero no equivale a un entorno chroot/aislado real.
 */
const getValidatedPath = (targetPath: string): string => {
  const projectRoot = process.cwd();
  const absolutePath = path.resolve(projectRoot, targetPath);

  // 1. Prevención robusta de Path Traversal
  const relativePath = path.relative(projectRoot, absolutePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`[Seguridad] Bloqueado: Intento de acceso fuera de los límites del proyecto (${targetPath})`);
  }

  // 2. Resolución de Symlinks (solo si el archivo ya existe)
  if (fs.existsSync(absolutePath)) {
    const realPath = fs.realpathSync(absolutePath);
    const realRelative = path.relative(projectRoot, realPath);
    if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
      throw new Error(`[Seguridad] Bloqueado: El enlace simbólico apunta fuera del proyecto.`);
    }
  }

  // 3. Bloqueo de directorios y archivos sensibles (analizando componentes reales)
  const pathSegments = absolutePath.split(path.sep);
  if (pathSegments.includes('.git')) {
    throw new Error(`[Seguridad] Bloqueado: No se permite alterar el directorio .git`);
  }

  const fileName = path.basename(absolutePath);
  if (fileName === '.env' || fileName.startsWith('.env.')) {
    throw new Error(`[Seguridad] Bloqueado: Acceso denegado a credenciales (.env)`);
  }

  return absolutePath;
};

// Excepción: La memoria del proyecto NUNCA se trunca
const isProjectMemory = (filePath: string): boolean => {
  // Normalizamos barras para que funcione igual en Windows y Linux
  const normalizedPath = filePath.replace(/\\/g, '/');
  return normalizedPath.includes('/.ia/') || normalizedPath.startsWith('.ia/');
};

export const readFileTool = (filePath: string): string => {
  try {
    const safePath = getValidatedPath(filePath);
    
    if (!fs.existsSync(safePath)) {
      return `Error: El archivo no existe en la ruta: ${filePath}`;
    }
    
    const content = fs.readFileSync(safePath, 'utf-8');
    
    // Solo truncamos si es muy grande Y NO es memoria del proyecto
    const MAX_CHARS = 3000;
    if (content.length > MAX_CHARS && !isProjectMemory(safePath)) {
      const truncated = content.substring(0, MAX_CHARS);
      return `${truncated}\n\n[Contenido truncado: mostrando ${MAX_CHARS} de ${content.length} caracteres. Si necesitas ver el resto, utiliza comandos como 'grep' o herramientas de búsqueda.]`;
    }
    
    return content;
  } catch (error: any) {
    return error.message;
  }
};

export const writeFileTool = (filePath: string, content: string): string => {
  try {
    const safePath = getValidatedPath(filePath);
    
    const dir = path.dirname(safePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(safePath, content, 'utf-8');
    return `Archivo guardado exitosamente en: ${filePath}`;
  } catch (error: any) {
    return error.message;
  }
};

/**
 * 🛡️ CAPA DE RESTRICCIÓN DE TERMINAL
 * Nota Técnica: Esto es un filtro de Blacklist básico (Deuda Técnica).
 * Evita comandos destructivos obvios, pero un atacante sofisticado podría eludirlo.
 */
export const runCommandTool = (command: string): string => {
  try {
    const lowerCmd = command.toLowerCase();

    // 1. Bloquear intentos de navegación fuera del proyecto en el terminal
    if (lowerCmd.includes('../') || lowerCmd.includes('..\\')) {
      return `[Seguridad] Comando bloqueado: No se permite navegar fuera del directorio actual.`;
    }

    // 2. Bloquear operaciones sobre .git
    if (lowerCmd.includes('.git')) {
        return `[Seguridad] Comando bloqueado: No se permiten operaciones directas sobre .git`;
    }

    // 3. Detección de comandos destructivos (incluso encadenados con &&, ||, ;, |)
    // Busca: rm, del, rd, rmdir, format, sudo, mv seguido de un espacio o al final.
    const dangerousRegex = /(?:^|&&|\|\||;|\|)\s*(rm|del|rd|rmdir|format|sudo|mv)\b/i;
    if (dangerousRegex.test(lowerCmd)) {
        return `[Seguridad] Comando bloqueado: Contiene operaciones destructivas prohibidas en este entorno.`;
    }

    // Aumentamos el timeout a 30s (30000ms) para permitir tests (npm test)
    const output = execSync(command, { encoding: 'utf-8', cwd: process.cwd(), timeout: 30000 });
    
    const MAX_CHARS = 3000;
    if (output.length > MAX_CHARS) {
        return `${output.substring(0, MAX_CHARS)}\n\n[Salida del terminal truncada para evitar sobrecarga de contexto...]`;
    }
    
    return output || "Comando ejecutado correctamente (sin salida en consola).";
  } catch (error: any) {
    return `Error ejecutando comando: ${error.message}`;
  }
};
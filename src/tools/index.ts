// src/tools/index.ts
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ToolContext } from './types';

/**
 * 🛡️ CAPA DE RESTRICCIÓN DE ARCHIVOS
 */
const getValidatedPath = (
  targetPath: string,
  context: ToolContext,
): string => {
  const projectRoot = context.workspacePath;
  const absolutePath = path.resolve(projectRoot, targetPath);

  // 1. Prevención robusta de Path Traversal
  const relativePath = path.relative(projectRoot, absolutePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`[Seguridad] Bloqueado: Intento de acceso fuera de los límites del proyecto (${targetPath})`);
  }

  // 2. Resolución de Symlinks en el archivo o cualquiera de sus directorios padres
  let checkPath = absolutePath;
  while (true) {
    if (fs.existsSync(checkPath)) {
      const realPath = fs.realpathSync(checkPath);
      const realRelative = path.relative(projectRoot, realPath);
      if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
        throw new Error(`[Seguridad] Bloqueado: El enlace simbólico apunta fuera del proyecto.`);
      }
      // Si el directorio existe y es seguro, no hace falta comprobar más arriba
      break;
    }
    const parent = path.dirname(checkPath);
    if (parent === checkPath) break; // Evita bucles infinitos en la raíz del disco
    checkPath = parent;
  }

  // 3. Bloqueo de directorios y archivos sensibles
  const pathSegments = absolutePath.split(path.sep);
  if (pathSegments.includes('.git')) {
    throw new Error(`[Seguridad] Bloqueado: No se permite operar sobre .git`);
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

export const readFileTool = (
  filePath: string,
  context: ToolContext,
): string => {
  try {
    const safePath = getValidatedPath(filePath, context);
    
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

export const writeFileTool = (
  filePath: string,
  content: string,
  context: ToolContext,
): string => {
  try {
    const safePath = getValidatedPath(filePath, context);
    
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

export const searchFileTool = (
  filePath: string,
  searchTerm: string,
  context: ToolContext,
): string => {
  try {
    const safePath = getValidatedPath(filePath, context);
    if (!fs.existsSync(safePath)) { 
      return `Error: El archivo no existe en la ruta: ${filePath}`;
    }
    else if (!fs.statSync(safePath).isFile()) {
      return `Error: La ruta especificada no es un archivo: ${filePath}`;
    }
    else if (searchTerm.trim() === '') {
      return `Error: El término de búsqueda no puede estar vacío.`;
    }
    else {
      const content = fs.readFileSync(safePath, 'utf-8');
      const lines = content.split('\n');
      
      const contextLines = 2; // Líneas extra arriba y abajo
      const resultLineIndices = new Set<number>();

      // 1. Identificar todas las líneas a incluir (coincidencia + contexto)
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(searchTerm)) {
          const start = Math.max(0, i - contextLines);
          const end = Math.min(lines.length - 1, i + contextLines);
          for (let j = start; j <= end; j++) {
            resultLineIndices.add(j);
          }
        }
      }

      if (resultLineIndices.size === 0) {
        return `No se encontraron coincidencias para el término de búsqueda: ${searchTerm}`;
      }

      // 2. Ordenar y formatear la salida con números de línea
      const sortedIndices = Array.from(resultLineIndices).sort((a, b) => a - b);
      let output = `Resultados para "${searchTerm}" en ${path.basename(filePath)}:\n\n`;
      let lastIndex = -2;

      for (const lineIdx of sortedIndices) {
        // Añadir separador si hay un salto entre bloques de contexto
        if (lastIndex !== -2 && lineIdx !== lastIndex + 1) {
          output += `...\n`;
        }
        
        const lineNumber = lineIdx + 1;
        // Marcamos con '>' la línea que contiene el término exacto
        const isMatch = lines[lineIdx].includes(searchTerm) ? ">" : " ";
        
        output += `${lineNumber.toString().padStart(4, ' ')} ${isMatch} ${lines[lineIdx]}\n`;
        lastIndex = lineIdx;
      }
      
      // Control de tamaño por si la búsqueda devuelve medio archivo
      const MAX_CHARS = 3000;
      if (output.length > MAX_CHARS) {
        return `${output.substring(0, MAX_CHARS)}\n\n[Salida truncada: Demasiadas coincidencias. Por favor, refina tu término de búsqueda.]`;
      }

      return output;
    }
  } catch (error: any) {
    return `Error buscando en el archivo: ${error.message}`;
  }
};

export const listFilesTool = (
  dirPath: string,
  context: ToolContext,
): string => {
  try {
    const safePath = getValidatedPath(dirPath, context);
    const lowerCmd = dirPath.toLowerCase();
    
    if (lowerCmd.includes('.git')) {
      return `[Seguridad] Comando bloqueado: No se permiten operaciones directas sobre .git`;
    }
    if (lowerCmd.includes('../') || lowerCmd.includes('..\\')) {
      return `[Seguridad] Comando bloqueado: No se permite navegar fuera del directorio actual.`;
    }
    if (!fs.existsSync(safePath)) {
      return `Error: El directorio no existe en la ruta: ${dirPath}`;
    }
    
    if (!fs.statSync(safePath).isDirectory()) {
      return `Error: La ruta especificada no es un directorio: ${dirPath}`;
    }
    const files = fs.readdirSync(safePath);
    return files.join('\n');
  } catch (error: any) {
    return `Error listando archivos: ${error.message}`;
  }
};

// Unused, only for future aplications
export const readJSONTool = (
  filePath: string,
  context: ToolContext,
): string => {
  try {
    const safePath = getValidatedPath(filePath, context);

    if (!fs.existsSync(safePath)) {
      return `Error: El archivo no existe en la ruta: ${filePath}`;
    }
    const content = fs.readFileSync(safePath, 'utf-8');
    try {
      const jsonData = JSON.parse(content);
      return JSON.stringify(jsonData, null, 2);
    } catch (error: any) {
      return `Error parseando JSON: ${error.message}`;
    }
  } catch (error: any) {
    return `Error leyendo archivo JSON: ${error.message}`;
  }
};

/**
 * 🛡️ CAPA DE RESTRICCIÓN DE TERMINAL
 * Nota Técnica: Esto es un filtro de Blacklist básico (Deuda Técnica).
 * Evita comandos destructivos obvios, pero un atacante sofisticado podría eludirlo.
 */
export const runCommandTool = (
  command: string,
  context: ToolContext,
): string => {
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

    // 3. Detección de comandos destructivos (AHORA SÍ CONTIENE '&' y 'remove-item')
    const dangerousRegex = /(?:^|&&|\|\||;|\||&)\s*(rm|del|rd|rmdir|format|sudo|mv|remove-item)\b/i;
    if (dangerousRegex.test(lowerCmd)) {
        return `[Seguridad] comando bloqueado: Contiene operaciones destructivas prohibidas en este entorno.`;
    }

    // Aumentamos el timeout a 30s (30000ms) para permitir tests (npm test)
    const output = execSync(command, { encoding: 'utf-8', cwd: context.workspacePath, timeout: 30000 });
    
    const MAX_CHARS = 3000;
    if (output.length > MAX_CHARS) {
        return `${output.substring(0, MAX_CHARS)}\n\n[Salida del terminal truncada para evitar sobrecarga de contexto...]`;
    }
    
    return output || "Comando ejecutado correctamente (sin salida en consola).";
  } catch (error: any) {
    return `Error ejecutando comando: ${error.message}`;
  }
};

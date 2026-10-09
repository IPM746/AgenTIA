// src/tools/index.ts
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  ToolContext,
  ToolExecutionResult,
  ToolExecutionStatus,
} from './types';
import { resolveWorkspacePath } from './security/workspaceGuard';

/**
 * 🛡️ CAPA DE RESTRICCIÓN DE ARCHIVOS
 */
const getValidatedPath = (
  targetPath: string,
  context: ToolContext,
): string => {
  const absolutePath = resolveWorkspacePath(targetPath, context);

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

const succeeded = (
  output: string,
  details: Omit<ToolExecutionResult, 'output' | 'success' | 'status'> = {},
): ToolExecutionResult => ({
  output,
  success: true,
  status: 'success',
  ...details,
});

const failed = (
  output: string,
  status: Exclude<ToolExecutionStatus, 'success'> = 'operation_failed',
  details: Omit<ToolExecutionResult, 'output' | 'success' | 'status' | 'error'> = {},
): ToolExecutionResult => ({
  output,
  success: false,
  status,
  error: output,
  ...details,
});

const failedFileOperation = (error: unknown): ToolExecutionResult => {
  const message = error instanceof Error ? error.message : String(error);
  return failed(
    message,
    message.startsWith('[Seguridad]') ? 'path_denied' : 'operation_failed',
  );
};


// Excepción: La memoria del proyecto NUNCA se trunca
const isProjectMemory = (filePath: string): boolean => {
  // Normalizamos barras para que funcione igual en Windows y Linux
  const normalizedPath = filePath.replace(/\\/g, '/');
  return normalizedPath.includes('/.ia/') || normalizedPath.startsWith('.ia/');
};

export const readFile = (
  filePath: string,
  context: ToolContext,
  startLine?: number,
  endLine?: number,
): ToolExecutionResult => {
  try {
    const safePath = getValidatedPath(filePath, context);
    
    if (!fs.existsSync(safePath)) {
      return failed(`Error: El archivo no existe en la ruta: ${filePath}`);
    }
    
    const content = fs.readFileSync(safePath, 'utf-8');
    if (startLine !== undefined || endLine !== undefined) {
      const lines = content.split('\n');
      const start = Math.max(1, startLine ?? 1);
      const end = Math.min(lines.length, endLine ?? lines.length);
      if (start > end) {
        return failed('Error: El rango de líneas solicitado no es válido.', 'validation_error');
      }
      return succeeded(lines
        .slice(start - 1, end)
        .map((line, index) => `${String(start + index).padStart(4, ' ')} | ${line}`)
        .join('\n'));
    }
    
    // Solo truncamos si es muy grande Y NO es memoria del proyecto
    const MAX_CHARS = 3000;
    if (content.length > MAX_CHARS && !isProjectMemory(safePath)) {
      const truncated = content.substring(0, MAX_CHARS);
      return succeeded(`${truncated}\n\n[Contenido truncado: mostrando ${MAX_CHARS} de ${content.length} caracteres. Si necesitas ver el resto, utiliza comandos como 'grep' o herramientas de búsqueda.]`);
    }
    
    return succeeded(content);
  } catch (error: any) {
    return failedFileOperation(error);
  }
};

export const readFileTool = (
  filePath: string,
  context: ToolContext,
  startLine?: number,
  endLine?: number,
): string => readFile(filePath, context, startLine, endLine).output;

export const writeFile = (
  filePath: string,
  content: string,
  context: ToolContext,
): ToolExecutionResult => {
  try {
    const safePath = getValidatedPath(filePath, context);
    
    const dir = path.dirname(safePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(safePath, content, 'utf-8');
    return succeeded(`Archivo guardado exitosamente en: ${filePath}`);
  } catch (error: any) {
    return failedFileOperation(error);
  }
};

export const writeFileTool = (
  filePath: string,
  content: string,
  context: ToolContext,
): string => writeFile(filePath, content, context).output;

export const applyPatch = (
  filePath: string,
  search: string,
  replacement: string,
  context: ToolContext,
): ToolExecutionResult => {
  try {
    const safePath = getValidatedPath(filePath, context);
    if (!fs.existsSync(safePath)) {
      return failed(`Error: El archivo no existe en la ruta: ${filePath}`);
    }
    if (!search) {
      return failed('Error: El texto a sustituir no puede estar vacío.', 'validation_error');
    }

    const content = fs.readFileSync(safePath, 'utf-8');
    const firstMatch = content.indexOf(search);
    if (firstMatch === -1) {
      return failed('Error: No se encontró el texto exacto para aplicar el parche.');
    }
    if (content.indexOf(search, firstMatch + search.length) !== -1) {
      return failed('Error: El texto del parche aparece más de una vez; usa una coincidencia más específica.');
    }

    const updated =
      content.substring(0, firstMatch) +
      replacement +
      content.substring(firstMatch + search.length);
    fs.writeFileSync(safePath, updated, 'utf-8');
    return succeeded(`Parche aplicado exitosamente en: ${filePath}`);
  } catch (error: any) {
    return failedFileOperation(error);
  }
};

export const applyPatchTool = (
  filePath: string,
  search: string,
  replacement: string,
  context: ToolContext,
): string => applyPatch(filePath, search, replacement, context).output;

export const searchFile = (
  filePath: string,
  searchTerm: string,
  context: ToolContext,
): ToolExecutionResult => {
  try {
    const safePath = getValidatedPath(filePath, context);
    if (!fs.existsSync(safePath)) { 
      return failed(`Error: El archivo no existe en la ruta: ${filePath}`);
    }
    else if (!fs.statSync(safePath).isFile()) {
      return failed(`Error: La ruta especificada no es un archivo: ${filePath}`);
    }
    else if (searchTerm.trim() === '') {
      return failed('Error: El término de búsqueda no puede estar vacío.', 'validation_error');
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
        return succeeded(`No se encontraron coincidencias para el término de búsqueda: ${searchTerm}`);
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
        return succeeded(`${output.substring(0, MAX_CHARS)}\n\n[Salida truncada: Demasiadas coincidencias. Por favor, refina tu término de búsqueda.]`);
      }

      return succeeded(output);
    }
  } catch (error: any) {
    const result = failedFileOperation(error);
    return {
      ...result,
      output: result.status === 'path_denied'
        ? result.output
        : `Error buscando en el archivo: ${result.output}`,
    };
  }
};

export const searchFileTool = (
  filePath: string,
  searchTerm: string,
  context: ToolContext,
): string => searchFile(filePath, searchTerm, context).output;

export const listFiles = (
  dirPath: string,
  context: ToolContext,
): ToolExecutionResult => {
  try {
    const safePath = getValidatedPath(dirPath, context);
    if (!fs.existsSync(safePath)) {
      return failed(`Error: El directorio no existe en la ruta: ${dirPath}`);
    }
    
    if (!fs.statSync(safePath).isDirectory()) {
      return failed(`Error: La ruta especificada no es un directorio: ${dirPath}`);
    }
    const files = fs.readdirSync(safePath);
    return succeeded(files.join('\n'));
  } catch (error: any) {
    const result = failedFileOperation(error);
    return {
      ...result,
      output: result.status === 'path_denied'
        ? result.output
        : `Error listando archivos: ${result.output}`,
    };
  }
};

export const listFilesTool = (
  dirPath: string,
  context: ToolContext,
): string => listFiles(dirPath, context).output;

export const readJSON = (
  filePath: string,
  context: ToolContext,
): ToolExecutionResult => {
  try {
    const safePath = getValidatedPath(filePath, context);

    if (!fs.existsSync(safePath)) {
      return failed(`Error: El archivo no existe en la ruta: ${filePath}`);
    }
    const content = fs.readFileSync(safePath, 'utf-8');
    try {
      const jsonData = JSON.parse(content);
      return succeeded(JSON.stringify(jsonData, null, 2));
    } catch (error: any) {
      return failed(`Error parseando JSON: ${error.message}`);
    }
  } catch (error: any) {
    const result = failedFileOperation(error);
    return {
      ...result,
      output: result.status === 'path_denied'
        ? result.output
        : `Error leyendo archivo JSON: ${result.output}`,
    };
  }
};

export const readJSONTool = (
  filePath: string,
  context: ToolContext,
): string => readJSON(filePath, context).output;

/**
 * 🛡️ CAPA DE RESTRICCIÓN DE TERMINAL
 * Nota Técnica: Esto es un filtro de Blacklist básico (Deuda Técnica).
 * Evita comandos destructivos obvios, pero un atacante sofisticado podría eludirlo.
 */
const limitCommandOutput = (output: string): string => {
  const MAX_CHARS = 3000;
  return output.length > MAX_CHARS
    ? `${output.substring(0, MAX_CHARS)}\n\n[Salida del terminal truncada para evitar sobrecarga de contexto...]`
    : output;
};

const commandOutputToText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  return Buffer.isBuffer(value) ? value.toString('utf-8') : '';
};

export const executeCommand = (
  command: string,
  context: ToolContext,
  timeoutMs = 30000,
): ToolExecutionResult => {
  try {
    const stdout = execSync(command, {
      encoding: 'utf-8',
      cwd: context.workspacePath,
      timeout: timeoutMs,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    return {
      output: limitCommandOutput(stdout || 'Comando ejecutado correctamente (sin salida en consola).'),
      success: true,
      status: 'success',
      exitCode: 0,
      stdout,
      stderr: '',
    };
  } catch (error: any) {
    const stdout = commandOutputToText(error.stdout);
    const stderr = commandOutputToText(error.stderr);
    const exitCode = typeof error.status === 'number' ? error.status : undefined;
    const details = [stdout, stderr, error.message]
      .filter((value, index, values) => value && values.indexOf(value) === index)
      .join('\n');

    return {
      output: limitCommandOutput(`Error ejecutando comando${exitCode === undefined ? '' : ` (exit code ${exitCode})`}: ${details}`),
      success: false,
      status: error.code === 'ETIMEDOUT'
        ? 'timeout'
        : typeof error.signal === 'string'
          ? 'signal'
          : 'operation_failed',
      error: error.message,
      exitCode,
      ...(typeof error.signal === 'string' ? { signal: error.signal } : {}),
      stdout,
      stderr,
    };
  }
};

export const runCommandTool = (
  command: string,
  context: ToolContext,
): string => executeCommand(command, context).output;

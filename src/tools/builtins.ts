import {
  listFilesTool,
  readFileTool,
  readJSONTool,
  runCommandTool,
  searchFileTool,
  writeFileTool,
} from './index';
import { ToolRegistry } from './registry';
import { Tool } from './types';

const getFilePath = (args: Record<string, unknown>): string =>
  (args.filePath ?? args.path ?? args.ruta) as string;

const getContent = (args: Record<string, unknown>): string =>
  (args.content ?? args.contenido) as string;

const getCommand = (args: Record<string, unknown>): string =>
  (args.command ?? args.comando) as string;

const getSearchTerm = (args: Record<string, unknown>): string =>
  (args.searchTerm ?? args.termino) as string;

const builtInTools: Tool[] = [
  {
    name: 'leer_archivo',
    description: "Lee el contenido de un archivo. ADVERTENCIA: Consume muchos tokens. Úsalo SOLO cuando necesites leer o sobrescribir el archivo completo. Para explorar código o buscar dónde se define algo, es OBLIGATORIO usar 'searchFileTool' primero.",
    inputSchema: {
      type: 'object',
      properties: {
        ruta: { type: 'string', description: 'La ruta del archivo (ej. package.json)' },
      },
      required: ['ruta'],
    },
    aliases: ['readFileTool', 'read_file'],
    execute: (args, context) =>
      readFileTool(getFilePath(args), context),
  },
  {
    name: 'searchFileTool',
    description: "Busca un texto dentro de un archivo y devuelve las líneas coincidentes con su contexto y número de línea. Úsalo SIEMPRE como primera opción para explorar código, localizar variables, funciones, clases o dependencias, en lugar de leer el archivo completo.",
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'La ruta del archivo (ej. src/index.ts)' },
        searchTerm: { type: 'string', description: 'El término a buscar dentro del archivo' },
      },
      required: ['filePath', 'searchTerm'],
    },
    aliases: ['buscar_archivo'],
    execute: (args, context) =>
      searchFileTool(getFilePath(args), getSearchTerm(args), context),
  },
  {
    name: 'escribir_archivo',
    description: 'Crea o sobrescribe un archivo con nuevo contenido.',
    inputSchema: {
      type: 'object',
      properties: {
        ruta: { type: 'string', description: 'La ruta del archivo' },
        contenido: { type: 'string', description: 'El contenido completo a escribir' },
      },
      required: ['ruta', 'contenido'],
    },
    aliases: ['writeFileTool', 'write_file'],
    execute: (args, context) =>
      writeFileTool(getFilePath(args), getContent(args), context),
  },
  {
    name: 'ejecutar_comando',
    description: 'Ejecuta un comando en la terminal (ej. tests o lints).',
    inputSchema: {
      type: 'object',
      properties: {
        comando: { type: 'string', description: 'El comando de consola a ejecutar' },
      },
      required: ['comando'],
    },
    aliases: ['runCommandTool', 'run_command'],
    execute: (args, context) =>
      runCommandTool(getCommand(args), context),
  },
  {
    name: 'listFilesTool',
    description: 'Lista los archivos y directorios de una ruta del proyecto.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'La ruta del directorio' },
      },
      required: ['filePath'],
    },
    execute: (args, context) =>
      listFilesTool(getFilePath(args), context),
  },
  {
    name: 'readJSONTool',
    description: 'Lee y formatea el contenido de un archivo JSON.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'La ruta del archivo JSON' },
      },
      required: ['filePath'],
    },
    execute: (args, context) =>
      readJSONTool(getFilePath(args), context),
  },
];

export const createBuiltinToolRegistry = (): ToolRegistry => {
  const registry = new ToolRegistry();

  for (const tool of builtInTools) {
    registry.register(tool);
  }

  return registry;
};

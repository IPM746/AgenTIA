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

const getFilePath = (args: Record<string, any>): string =>
  args.filePath ?? args.path ?? args.ruta;

const getContent = (args: Record<string, any>): string =>
  args.content ?? args.contenido;

const getCommand = (args: Record<string, any>): string =>
  args.command ?? args.comando;

const getSearchTerm = (args: Record<string, any>): string =>
  args.searchTerm ?? args.termino;

const builtInTools: Tool[] = [
  {
    name: 'leer_archivo',
    aliases: ['readFileTool', 'read_file'],
    execute: (args, context) =>
      readFileTool(getFilePath(args), context),
  },
  {
    name: 'searchFileTool',
    aliases: ['buscar_archivo'],
    execute: (args, context) =>
      searchFileTool(getFilePath(args), getSearchTerm(args), context),
  },
  {
    name: 'escribir_archivo',
    aliases: ['writeFileTool', 'write_file'],
    execute: (args, context) =>
      writeFileTool(getFilePath(args), getContent(args), context),
  },
  {
    name: 'ejecutar_comando',
    aliases: ['runCommandTool', 'run_command'],
    execute: (args, context) =>
      runCommandTool(getCommand(args), context),
  },
  {
    name: 'listFilesTool',
    execute: (args, context) =>
      listFilesTool(getFilePath(args), context),
  },
  {
    name: 'readJSONTool',
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

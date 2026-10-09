import * as assert from 'assert';
import * as path from 'path';
import { analyzeToolArguments } from '../src/tools/security/lexicalAnalyzer';
import { resolveWorkspacePath } from '../src/tools/security/workspaceGuard';
import { ToolExecutor } from '../src/tools/executor';
import { ToolRegistry } from '../src/tools/registry';
import { Tool, ToolContext } from '../src/tools/types';
import { createBuiltinToolRegistry } from '../src/tools/builtins';

const context: ToolContext = {
  workspacePath: process.cwd(),
  allowedPermissions: ['process.execute'],
};

const tool: Tool = {
  name: 'command_tool',
  description: 'Runs a command.',
  permissions: ['process.execute'],
  lexicalArguments: ['command'],
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string' },
      mode: { type: 'string', enum: ['safe', 'fast'] },
    },
    required: ['command', 'mode'],
    additionalProperties: false,
  },
  execute: () => ({ output: 'executed', success: true, status: 'success' }),
};

const runTests = async () => {
  const registry = new ToolRegistry();
  registry.register(tool);
  const executor = new ToolExecutor();

  assert.strictEqual(
    await executor.execute(tool, { command: 'echo ok', mode: 'safe' }, context),
    'executed',
  );
  assert.match(
    await executor.execute(tool, { mode: 'safe' }, context),
    /command es obligatorio/,
  );
  assert.match(
    await executor.execute(tool, { command: 1, mode: 'safe' }, context),
    /debe ser de tipo string/,
  );
  assert.match(
    await executor.execute(tool, { command: 'echo ok', mode: 'unsafe' }, context),
    /valores permitidos/,
  );
  assert.match(
    await executor.execute(tool, { command: 'echo ok', mode: 'safe', extra: true }, context),
    /no está permitido/,
  );

  const denied = await executor.execute(
    tool,
    { command: 'echo ok', mode: 'safe' },
    { workspacePath: context.workspacePath, allowedPermissions: [] },
  );
  assert.match(denied, /requiere el permiso 'process.execute'/);
  assert.match(
    await executor.execute(
      tool,
      { command: 'echo ok', mode: 'safe' },
      { workspacePath: context.workspacePath },
    ),
    /requiere el permiso 'process.execute'/,
  );

  const noPermissionTool: Tool = {
    ...tool,
    name: 'read_only_tool',
    permissions: [],
  };
  assert.strictEqual(
    await executor.execute(noPermissionTool, { command: 'echo ok', mode: 'safe' }, context),
    'executed',
  );

  assert.strictEqual(
    analyzeToolArguments(tool, { command: 'echo formatters', mode: 'safe' }).risk,
    'low',
  );
  assert.strictEqual(
    analyzeToolArguments(tool, { command: 'echo one && echo two', mode: 'safe' }).risk,
    'medium',
  );
  assert.strictEqual(
    analyzeToolArguments(tool, { command: 'Remove-Item cache -Recurse', mode: 'safe' }).risk,
    'high',
  );
  assert.match(
    await executor.execute(tool, { command: 'Remove-Item cache -Recurse', mode: 'safe' }, context),
    /bloqueada.*alto riesgo/,
  );
  assert.match(
    await executor.execute(tool, { command: 'rm -rf cache', mode: 'safe' }, context),
    /bloqueada.*alto riesgo/,
  );
  assert.match(
    await executor.execute(tool, { command: 'cmd /c echo ok', mode: 'safe' }, context),
    /requiere confirmación/,
  );
  assert.match(
    await executor.execute(tool, { command: 'cmd.exe /c echo ok', mode: 'safe' }, context),
    /requiere confirmación/,
  );
  assert.match(
    await executor.execute(tool, { command: 'pwsh -c echo ok', mode: 'safe' }, context),
    /requiere confirmación/,
  );
  assert.match(
    await executor.execute(tool, { command: 'Invoke-Expression "echo ok"', mode: 'safe' }, context),
    /requiere confirmación/,
  );

  const writeTool = createBuiltinToolRegistry().resolve('escribir_archivo');
  assert.ok(writeTool);
  assert.strictEqual(
    analyzeToolArguments(writeTool, {
      ruta: 'src/test.ts',
      contenido: "const command = 'Remove-Item cache -Recurse';",
    }).risk,
    'low',
  );

  const multiPermissionTool: Tool = {
    ...tool,
    name: 'multi_permission_tool',
    permissions: ['filesystem.read', 'process.execute'],
  };
  assert.match(
    await executor.execute(
      multiPermissionTool,
      { command: 'echo ok', mode: 'safe' },
      { workspacePath: context.workspacePath, allowedPermissions: ['filesystem.read'] },
    ),
    /process.execute/,
  );

  const resolved = registry.resolve('command_tool');
  assert.ok(resolved);
  assert.strictEqual(
    await executor.execute(resolved, { command: 'echo ok', mode: 'safe' }, context),
    'executed',
  );

  assert.strictEqual(
    resolveWorkspacePath('tests/../package.json', context),
    path.join(context.workspacePath, 'package.json'),
  );
  assert.throws(
    () => resolveWorkspacePath('../outside.txt', context),
    /fuera de los límites/,
  );
  assert.throws(
    () => resolveWorkspacePath(path.resolve(context.workspacePath, '..', 'outside.txt'), context),
    /fuera de los límites/,
  );

  console.log('Security gate superado.');
};

void runTests();

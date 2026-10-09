import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createBuiltinToolRegistry } from '../src/tools/builtins';
import { ToolExecutor } from '../src/tools/executor';
import { resolveWorkspacePath } from '../src/tools/security/workspaceGuard';
import { Tool, ToolContext } from '../src/tools/types';

const makeDirectoryLink = (targetPath: string, linkPath: string): void => {
  fs.symlinkSync(targetPath, linkPath, 'junction');
};

const argsForTool = (tool: Tool, blockedPath: string): Record<string, unknown> => {
  const pathArgument = tool.pathArguments?.[0];
  assert.ok(pathArgument, `${tool.name} debe declarar su argumento de ruta.`);

  const args: Record<string, unknown> = { [pathArgument]: blockedPath };
  if (tool.name === 'searchFileTool') args.searchTerm = 'needle';
  if (tool.name === 'escribir_archivo') args.contenido = 'blocked';
  if (tool.name === 'applyPatchTool') {
    args.search = 'before';
    args.replacement = 'after';
  }
  return args;
};

const runTests = async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentia-workspace-guard-'));

  try {
    const workspace = path.join(tempRoot, 'workspace');
    const outside = path.join(tempRoot, 'outside');
    fs.mkdirSync(path.join(workspace, 'inside'), { recursive: true });
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(workspace, 'inside', 'existing.txt'), 'inside');

    const context: ToolContext = {
      workspacePath: workspace,
      allowedPermissions: ['filesystem.read', 'filesystem.write'],
    };

    assert.strictEqual(
      resolveWorkspacePath('inside/../inside/new.txt', context),
      path.join(workspace, 'inside', 'new.txt'),
    );
    assert.strictEqual(
      resolveWorkspacePath('new-directory/new.txt', context),
      path.join(workspace, 'new-directory', 'new.txt'),
    );
    assert.strictEqual(
      resolveWorkspacePath('..named-file', context),
      path.join(workspace, '..named-file'),
    );
    assert.throws(
      () => resolveWorkspacePath('../outside/blocked.txt', context),
      /fuera de los límites/,
    );
    assert.throws(
      () => resolveWorkspacePath(path.join(outside, 'blocked.txt'), context),
      /fuera de los límites/,
    );

    makeDirectoryLink(path.join(workspace, 'inside'), path.join(workspace, 'link-inside'));
    assert.strictEqual(
      resolveWorkspacePath('link-inside/created-later.txt', context),
      path.join(workspace, 'link-inside', 'created-later.txt'),
    );

    makeDirectoryLink(outside, path.join(workspace, 'link-outside'));
    assert.throws(
      () => resolveWorkspacePath('link-outside/blocked.txt', context),
      /enlace simbólico apunta fuera/,
    );

    const danglingLink = path.join(workspace, 'link-dangling');
    makeDirectoryLink(path.join(outside, 'missing-target'), danglingLink);
    assert.throws(
      () => resolveWorkspacePath('link-dangling/blocked.txt', context),
      /enlace simbólico no tiene un destino válido/,
    );

    const workspaceAlias = path.join(tempRoot, 'workspace-alias');
    makeDirectoryLink(workspace, workspaceAlias);
    assert.strictEqual(
      resolveWorkspacePath('inside/existing.txt', { ...context, workspacePath: workspaceAlias }),
      path.join(workspaceAlias, 'inside', 'existing.txt'),
    );

    const executor = new ToolExecutor();
    const registry = createBuiltinToolRegistry();
    for (const tool of registry.list().filter((candidate) =>
      candidate.permissions?.some((permission) => permission.startsWith('filesystem.')),
    )) {
      const result = await executor.execute(
        tool,
        argsForTool(tool, '../outside/blocked.txt'),
        context,
      );
      assert.match(result, /fuera de los límites/, `${tool.name} debe pasar por el Security Gate.`);
    }

    let executed = false;
    const undeclaredPathTool: Tool = {
      name: 'undeclared_path_tool',
      description: 'Should not execute without a path declaration.',
      permissions: ['filesystem.read'],
      inputSchema: {
        type: 'object',
        properties: { target: { type: 'string' } },
        required: ['target'],
        additionalProperties: false,
      },
      execute: () => {
        executed = true;
        return { output: 'unexpected', success: true, status: 'success' };
      },
    };
    assert.match(
      await executor.execute(undeclaredPathTool, { target: '../outside/blocked.txt' }, context),
      /no declara los argumentos de ruta/,
    );
    assert.strictEqual(executed, false);

    console.log('Workspace guard superado.');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
};

void runTests();

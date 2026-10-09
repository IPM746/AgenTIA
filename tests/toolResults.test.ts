import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createBuiltinToolRegistry } from '../src/tools/builtins';
import { ToolExecutor } from '../src/tools/executor';
import { executeCommand } from '../src/tools';
import { Tool, ToolContext } from '../src/tools/types';

const getTool = (name: string): Tool => {
  const tool = createBuiltinToolRegistry().resolve(name);
  assert.ok(tool, `La herramienta ${name} debe estar registrada.`);
  return tool;
};

const runTests = async () => {
  const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'agentia-tool-results-'));
  const executor = new ToolExecutor();
  const context: ToolContext = {
    workspacePath,
    allowedPermissions: ['filesystem.read', 'filesystem.write', 'process.execute'],
  };

  try {
    fs.mkdirSync(path.join(workspacePath, 'directory'));
    fs.mkdirSync(path.join(workspacePath, 'directory', '.git'));
    fs.writeFileSync(path.join(workspacePath, 'source.txt'), 'original');
    fs.writeFileSync(path.join(workspacePath, 'invalid.json'), '{ invalid json');
    fs.writeFileSync(path.join(workspacePath, '.env'), 'TOKEN=secret');

    const readMissing = await executor.executeDetailed(
      getTool('leer_archivo'),
      { ruta: 'missing.txt' },
      context,
    );
    assert.strictEqual(readMissing.success, false);
    assert.strictEqual(readMissing.status, 'operation_failed');

    const writeDirectory = await executor.executeDetailed(
      getTool('escribir_archivo'),
      { ruta: 'directory', contenido: 'cannot replace a directory' },
      context,
    );
    assert.strictEqual(writeDirectory.success, false);
    assert.strictEqual(writeDirectory.status, 'operation_failed');

    const patchMissing = await executor.executeDetailed(
      getTool('applyPatchTool'),
      { filePath: 'source.txt', search: 'not present', replacement: 'new' },
      context,
    );
    assert.strictEqual(patchMissing.success, false);
    assert.strictEqual(patchMissing.status, 'operation_failed');

    const searchMissing = await executor.executeDetailed(
      getTool('searchFileTool'),
      { filePath: 'missing.txt', searchTerm: 'needle' },
      context,
    );
    assert.strictEqual(searchMissing.success, false);
    assert.strictEqual(searchMissing.status, 'operation_failed');

    const listMissing = await executor.executeDetailed(
      getTool('listFilesTool'),
      { filePath: 'missing-directory' },
      context,
    );
    assert.strictEqual(listMissing.success, false);
    assert.strictEqual(listMissing.status, 'operation_failed');

    const invalidJson = await executor.executeDetailed(
      getTool('readJSONTool'),
      { filePath: 'invalid.json' },
      context,
    );
    assert.strictEqual(invalidJson.success, false);
    assert.strictEqual(invalidJson.status, 'operation_failed');

    const deniedPermission = await executor.executeDetailed(
      getTool('escribir_archivo'),
      { ruta: 'denied.txt', contenido: 'blocked' },
      { workspacePath, allowedPermissions: ['filesystem.read'] },
    );
    assert.strictEqual(deniedPermission.success, false);
    assert.strictEqual(deniedPermission.status, 'permission_denied');

    const deniedPath = await executor.executeDetailed(
      getTool('leer_archivo'),
      { ruta: '../outside.txt' },
      context,
    );
    assert.strictEqual(deniedPath.success, false);
    assert.strictEqual(deniedPath.status, 'path_denied');

    const deniedGit = await executor.executeDetailed(
      getTool('leer_archivo'),
      { ruta: 'directory/.git/config' },
      context,
    );
    assert.strictEqual(deniedGit.success, false);
    assert.strictEqual(deniedGit.status, 'path_denied');

    const deniedEnv = await executor.executeDetailed(
      getTool('leer_archivo'),
      { ruta: '.env' },
      context,
    );
    assert.strictEqual(deniedEnv.success, false);
    assert.strictEqual(deniedEnv.status, 'path_denied');

    const internalTraversal = await executor.executeDetailed(
      getTool('listFilesTool'),
      { filePath: 'directory/../directory' },
      context,
    );
    assert.strictEqual(internalTraversal.success, true);

    const invalidArguments = await executor.executeDetailed(
      getTool('leer_archivo'),
      {},
      context,
    );
    assert.strictEqual(invalidArguments.success, false);
    assert.strictEqual(invalidArguments.status, 'validation_error');

    const commandFailure = await executor.executeDetailed(
      getTool('ejecutar_comando'),
      { comando: 'node -e "process.exit(5)"' },
      context,
    );
    assert.strictEqual(commandFailure.success, false);
    assert.strictEqual(commandFailure.status, 'operation_failed');
    assert.strictEqual(commandFailure.exitCode, 5);

    const mediumRiskCommand = await executor.executeDetailed(
      getTool('ejecutar_comando'),
      { comando: 'echo one && echo two' },
      context,
    );
    assert.strictEqual(mediumRiskCommand.success, false);
    assert.strictEqual(mediumRiskCommand.status, 'blocked');
    assert.match(mediumRiskCommand.output, /requiere confirmación humana explícita/);

    const timeout = executeCommand(
      'node -e "setTimeout(() => {}, 100)"',
      context,
      25,
    );
    assert.strictEqual(timeout.success, false);
    assert.strictEqual(timeout.status, 'timeout');
    // On Windows the shell can release its working directory just after execSync returns.
    await new Promise((resolve) => setTimeout(resolve, 250));

    const thrownTool: Tool = {
      name: 'throws',
      description: 'Throws for result normalization coverage.',
      inputSchema: { type: 'object' },
      execute: () => {
        throw new Error('unexpected failure');
      },
    };
    const exception = await executor.executeDetailed(thrownTool, {}, context);
    assert.strictEqual(exception.success, false);
    assert.strictEqual(exception.status, 'exception');

    console.log('Resultados estructurados de herramientas superados.');
  } finally {
    fs.rmSync(workspacePath, { recursive: true, force: true });
  }
};

void runTests();

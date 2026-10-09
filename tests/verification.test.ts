import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  getVerificationCommands,
  shouldRunVerification,
  VerificationLoop,
} from '../src/engine/verification';
import { createBuiltinToolRegistry } from '../src/tools/builtins';
import { ToolExecutor } from '../src/tools/executor';
import { Tool, ToolContext } from '../src/tools/types';

const context: ToolContext = {
  workspacePath: process.cwd(),
  allowedPermissions: ['process.execute'],
};

const createCommandTool = (results: string[], calls: string[]): Tool => ({
  name: 'ejecutar_comando',
  description: 'Runs a verification command.',
  permissions: ['process.execute'],
  lexicalArguments: ['comando'],
  inputSchema: {
    type: 'object',
    properties: { comando: { type: 'string' } },
    required: ['comando'],
    additionalProperties: false,
  },
  execute: (args) => {
    calls.push(args.comando as string);
    const output = results.shift() ?? 'ok';
    return {
      output,
      success: !output.startsWith('Error:'),
      exitCode: output.startsWith('Error:') ? 1 : 0,
      stdout: output.startsWith('Error:') ? '' : output,
      stderr: output.startsWith('Error:') ? output : '',
    };
  },
});

const createLoop = (results: string[], maxCycles?: number) => {
  const calls: string[] = [];
  const tool = createCommandTool(results, calls);
  return {
    calls,
    loop: new VerificationLoop(
      new ToolExecutor(),
      tool,
      context,
      {
        commands: ['npm test', 'npm run typecheck', 'npm run build'],
        ...(maxCycles === undefined ? {} : { maxCycles }),
      },
    ),
  };
};

const runTests = async () => {
  assert.strictEqual(shouldRunVerification(false), false);
  assert.strictEqual(shouldRunVerification(true), true);

  const success = createLoop(['tests ok', 'types ok', 'build ok']);
  const successfulResult = await success.loop.verify();
  assert.strictEqual(successfulResult.passed, true);
  assert.strictEqual(successfulResult.attempts.length, 3);
  assert.deepStrictEqual(success.calls, ['npm test', 'npm run typecheck', 'npm run build']);

  const failure = createLoop(['Error: tests failed']);
  const failedResult = await failure.loop.verify();
  assert.strictEqual(failedResult.passed, false);
  assert.strictEqual(failedResult.canRepair, true);
  assert.strictEqual(failedResult.exhausted, false);
  assert.strictEqual(failedResult.attempts[0].error, 'Error: tests failed');

  const repaired = createLoop(['Error: tests failed', 'tests ok', 'types ok', 'build ok']);
  const firstRepairResult = await repaired.loop.verify();
  assert.strictEqual(firstRepairResult.passed, false);
  const repairedResult = await repaired.loop.verify();
  assert.strictEqual(repairedResult.passed, true);
  assert.strictEqual(repairedResult.cycle, 2);

  const bounded = createLoop(['Error: failed', 'Error: failed', 'Error: failed'], 2);
  const limitFirst = await bounded.loop.verify();
  const limitSecond = await bounded.loop.verify();
  const afterLimit = await bounded.loop.verify();
  assert.strictEqual(limitFirst.canRepair, true);
  assert.strictEqual(limitSecond.exhausted, true);
  assert.strictEqual(afterLimit.exhausted, true);
  assert.strictEqual(afterLimit.attempts.length, 0);
  assert.strictEqual(bounded.calls.length, 2);

  const blockedCalls: string[] = [];
  const blockedTool = createCommandTool(['unexpected'], blockedCalls);
  const blockedLoop = new VerificationLoop(
    new ToolExecutor(),
    blockedTool,
    context,
    { commands: ['Remove-Item cache -Recurse'] },
  );
  const blockedResult = await blockedLoop.verify();
  assert.strictEqual(blockedResult.passed, false);
  assert.match(blockedResult.attempts[0].result, /bloqueada.*alto riesgo/);
  assert.strictEqual(blockedCalls.length, 0);

  const realCommandTool = createBuiltinToolRegistry().resolve('ejecutar_comando');
  assert.ok(realCommandTool);
  const realFailure = new VerificationLoop(
    new ToolExecutor(),
    realCommandTool,
    context,
    { commands: ['node -e "process.exit(7)"'] },
  );
  const realFailureResult = await realFailure.verify();
  assert.strictEqual(realFailureResult.passed, false);
  assert.strictEqual(realFailureResult.attempts[0].exitCode, 7);
  assert.match(realFailureResult.attempts[0].result, /exit code 7/);

  const neverInfinite = createLoop(Array(10).fill('Error: failed'), 3);
  for (let index = 0; index < 10; index++) {
    await neverInfinite.loop.verify();
  }
  assert.strictEqual(neverInfinite.calls.length, 3);
  assert.strictEqual(neverInfinite.loop.getAttempts().length, 3);

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentia-verification-'));
  try {
    fs.writeFileSync(path.join(tempRoot, 'package.json'), JSON.stringify({
      scripts: { test: 'tsx tests', typecheck: 'tsc --noEmit', build: 'tsc' },
    }));
    assert.deepStrictEqual(getVerificationCommands(tempRoot), [
      'npm test',
      'npm run typecheck',
      'npm run build',
    ]);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  console.log('Verification loop superado.');
};

void runTests();

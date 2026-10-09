import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  evaluateBenchmarkAssertions,
  snapshotWorkspace,
} from '../src/benchmark/evaluator';

const runTests = () => {
  const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'agentia-benchmark-'));
  try {
    fs.writeFileSync(path.join(workspacePath, 'calculator.ts'), 'export const add = () => 3;\n');
    const before = snapshotWorkspace(workspacePath);

    const readOnly = evaluateBenchmarkAssertions(
      { mustMention: ['add'], mustNotModifyFiles: true },
      workspacePath,
      'La función add devuelve 3.',
      before,
    );
    assert.strictEqual(readOnly.passed, true);

    fs.writeFileSync(path.join(workspacePath, 'calculator.ts'), 'changed');
    const changedReadOnly = evaluateBenchmarkAssertions(
      { mustNotModifyFiles: true },
      workspacePath,
      'Sin cambios.',
      before,
    );
    assert.strictEqual(changedReadOnly.passed, false);
    assert.match(changedReadOnly.failures[0], /solo lectura/);

    fs.writeFileSync(path.join(workspacePath, 'greeting.ts'), 'export const greet = () => "Hello";\n');
    const contentMismatch = evaluateBenchmarkAssertions(
      { file: 'greeting.ts', expectedContent: 'expected' },
      workspacePath,
      '',
      snapshotWorkspace(workspacePath),
    );
    assert.strictEqual(contentMismatch.passed, false);

    fs.writeFileSync(path.join(workspacePath, 'math.ts'), 'export const multiply = (a: number, b: number) => { return a * b; };');
    const math = evaluateBenchmarkAssertions(
      { expectedMathImplementation: 'multiply returns a * b' },
      workspacePath,
      '',
      snapshotWorkspace(workspacePath),
    );
    assert.strictEqual(math.passed, true);

    const missingMention = evaluateBenchmarkAssertions(
      { mustMentionFiles: ['src/service.ts'] },
      workspacePath,
      'src/controller.ts',
      snapshotWorkspace(workspacePath),
    );
    assert.strictEqual(missingMention.passed, false);

    console.log('Evaluador de benchmark superado.');
  } finally {
    fs.rmSync(workspacePath, { recursive: true, force: true });
  }
};

runTests();

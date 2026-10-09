import * as assert from 'assert';
import { getAgentExitCode } from '../src/engine/agent';
import { parseCliTask } from '../src/index';

const metrics = (result: 'success' | 'failure' | 'max_iterations', verificationStatus: 'not_needed' | 'passed' | 'failed' | 'unavailable') => ({
  result,
  verificationStatus,
} as Parameters<typeof getAgentExitCode>[0]['metrics']);

const runTests = () => {
  assert.deepStrictEqual(parseCliTask(['revisa', 'el', 'proyecto']), {
    task: 'revisa el proyecto',
    mode: 'edit',
  });
  assert.deepStrictEqual(parseCliTask(['--mode', 'read-only', 'revisa', 'el', 'proyecto']), {
    task: 'revisa el proyecto',
    mode: 'read_only',
  });
  assert.deepStrictEqual(parseCliTask(['crea', 'un', 'archivo', '--mode', 'edit']), {
    task: 'crea un archivo',
    mode: 'edit',
  });
  assert.strictEqual(parseCliTask(['--mode', 'unsafe', 'tarea']), undefined);
  assert.strictEqual(parseCliTask([]), undefined);

  assert.strictEqual(getAgentExitCode({ finalText: '', metrics: metrics('success', 'passed') }), 0);
  assert.strictEqual(getAgentExitCode({ finalText: '', metrics: metrics('success', 'not_needed') }), 0);
  assert.strictEqual(getAgentExitCode({ finalText: '', metrics: metrics('success', 'unavailable') }), 2);
  assert.strictEqual(getAgentExitCode({ finalText: '', metrics: metrics('failure', 'failed') }), 1);
  assert.strictEqual(getAgentExitCode({ finalText: '', metrics: metrics('max_iterations', 'not_needed') }), 1);

  console.log('CLI y códigos de salida superados.');
};

runTests();

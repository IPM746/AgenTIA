import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getConfigTemplate, loadConfig } from '../src/config/env';

const runTests = () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agentia-config-'));
  const configPath = path.join(tempRoot, 'config.json');

  try {
    const defaultConfig = loadConfig({ configPath, env: {} });
    assert.strictEqual(defaultConfig.provider, 'ollama');
    assert.strictEqual(defaultConfig.model, 'qwen3.5:4b');

    const ollamaConfig = loadConfig({
      configPath,
      env: { AI_PROVIDER: 'ollama' },
    });
    assert.strictEqual(ollamaConfig.provider, 'ollama');
    assert.strictEqual(ollamaConfig.model, 'qwen3.5:4b');
    assert.strictEqual(ollamaConfig.maxIter, 5);

    fs.writeFileSync(configPath, JSON.stringify({
      provider: 'openrouter',
      model: 'provider/model',
      maxIter: 7,
      contextMaxTokens: 4000,
      verificationMaxCycles: 2,
    }));
    const configured = loadConfig({
      configPath,
      env: { OPENROUTER_API_KEY: 'test-key' },
    });
    assert.strictEqual(configured.provider, 'openrouter');
    assert.strictEqual(configured.model, 'provider/model');
    assert.strictEqual(configured.maxIter, 7);
    assert.strictEqual(configured.contextMaxTokens, 4000);
    assert.strictEqual(configured.verificationMaxCycles, 2);
    assert.strictEqual(configured.apiKey, 'test-key');

    const overridden = loadConfig({
      configPath,
      env: {
        AI_PROVIDER: 'ollama',
        AI_MODEL: 'custom-local',
        AI_MAX_ITER: '4',
        AI_CONTEXT_MAX_TOKENS: '8000',
        AI_VERIFICATION_MAX_CYCLES: '5',
      },
    });
    assert.strictEqual(overridden.provider, 'ollama');
    assert.strictEqual(overridden.model, 'custom-local');
    assert.strictEqual(overridden.maxIter, 4);
    assert.strictEqual(overridden.contextMaxTokens, 8000);
    assert.strictEqual(overridden.verificationMaxCycles, 5);

    assert.throws(
      () => loadConfig({ configPath, env: { AI_PROVIDER: 'unknown' } }),
      /Proveedor no reconocido/,
    );
    assert.throws(
      () => loadConfig({ configPath, env: { AI_PROVIDER: 'ollama', AI_MAX_ITER: '0' } }),
      /AI_MAX_ITER debe ser un entero positivo/,
    );
    assert.throws(
      () => loadConfig({ configPath, env: { AI_PROVIDER: 'gemini' } }),
      /GEMINI_API_KEY/,
    );

    fs.writeFileSync(configPath, '{ invalid');
    assert.throws(
      () => loadConfig({ configPath, env: { AI_PROVIDER: 'ollama' } }),
      /Configuración global inválida/,
    );
    assert.match(getConfigTemplate(), /"provider": "ollama"/);
    assert.doesNotMatch(getConfigTemplate(), /API_KEY|test-key/);

    console.log('Configuración global superada.');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
};

runTests();

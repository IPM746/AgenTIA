import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  applyPatchTool,
  readFileTool,
  runCommandTool,
  searchFileTool,
  writeFileTool,
} from '../src/tools/index';

const runTests = () => {
  console.log('Iniciando tests de seguridad...\n');

  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ia-agent-security-'));
  const workspacePath = path.join(testRoot, 'workspace');
  const outsidePath = path.join(testRoot, 'outside');
  const toolContext = { workspacePath };
  fs.mkdirSync(workspacePath);
  fs.mkdirSync(outsidePath);

  try {
    const testDir = path.join(workspacePath, 'test_env');
    fs.mkdirSync(testDir);
    fs.mkdirSync(path.join(testDir, '.git'));
    fs.writeFileSync(path.join(outsidePath, 'secret.txt'), 'top-secret');
    fs.writeFileSync(path.join(testDir, '.env'), 'KEY=123');

    fs.symlinkSync(outsidePath, path.join(testDir, 'fake_dir'), 'junction');

    assert.match(readFileTool('../outside/secret.txt', toolContext), /Bloqueado: Intento de acceso fuera/);
    assert.match(writeFileTool(path.join(outsidePath, 'hacked.txt'), 'hack', toolContext), /Bloqueado: Intento de acceso fuera/);
    assert.match(readFileTool('test_env/.git/config', toolContext), /No se permite operar sobre \.git/);
    assert.match(readFileTool('test_env/.env', toolContext), /Acceso denegado a credenciales/);
    assert.match(writeFileTool('test_env/fake_dir/new.txt', 'hack', toolContext), /enlace simbólico apunta fuera/);
    console.log('✅ Límites, secretos y symlinks bloqueados');

    assert.match(runCommandTool('echo test_valido', toolContext), /test_valido/);

    const largeText = 'A'.repeat(5000);
    fs.writeFileSync(path.join(testDir, 'large.txt'), largeText);
    assert.match(readFileTool('test_env/large.txt', toolContext), /Contenido truncado: mostrando 3000/);
    fs.mkdirSync(path.join(workspacePath, '.ia'));
    fs.writeFileSync(path.join(workspacePath, '.ia', 'rules.md'), largeText);
    assert.strictEqual(readFileTool('.ia/rules.md', toolContext).length, 5000);

    fs.writeFileSync(path.join(testDir, 'lines.ts'), 'uno\ndos\nfunction objetivo() {}\ncuatro\ncinco');
    const range = readFileTool('test_env/lines.ts', toolContext, 2, 4);
    assert.match(range, /\s+2 \| dos/);
    assert.doesNotMatch(range, /uno/);
    assert.match(searchFileTool('test_env/lines.ts', 'objetivo', toolContext), /> function objetivo/);

    assert.match(writeFileTool('test_env/created.txt', 'contenido seguro', toolContext), /guardado exitosamente/);
    assert.match(applyPatchTool('test_env/created.txt', 'seguro', 'validado', toolContext), /Parche aplicado exitosamente/);
    assert.strictEqual(fs.readFileSync(path.join(testDir, 'created.txt'), 'utf-8'), 'contenido validado');
    assert.match(applyPatchTool('test_env/created.txt', 'ausente', 'x', toolContext), /No se encontró el texto exacto/);
    console.log('✅ Lectura parcial, búsqueda, escritura y parche funcionan');
  } finally {
    fs.rmSync(testRoot, { recursive: true, force: true });
  }

  console.log('\nTodos los tests de seguridad superados.');
};

runTests();

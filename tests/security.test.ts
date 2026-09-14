// tests/security.test.ts
import * as fs from 'fs';
import * as path from 'path';
import * as assert from 'assert';
import { readFileTool, writeFileTool, runCommandTool } from '../src/tools/index';

const runTests = () => {
  console.log("Iniciando tests de seguridad...\n");

  // --- SETUP DEL ENTORNO ---
  const projectRoot = process.cwd();
  const testDir = path.join(projectRoot, 'test_env');
  const outsideDir = path.resolve(projectRoot, '../test_outside');
  
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);
  if (!fs.existsSync(outsideDir)) fs.mkdirSync(outsideDir);
  if (!fs.existsSync(path.join(testDir, '.git'))) fs.mkdirSync(path.join(testDir, '.git'));
  
  fs.writeFileSync(path.join(outsideDir, 'secret.txt'), 'top-secret');
  fs.writeFileSync(path.join(testDir, '.env'), 'KEY=123');
  
  // Symlink (Junction para evitar problemas de permisos en Windows)
  const symlinkPath = path.join(testDir, 'fake_dir');
  if (!fs.existsSync(symlinkPath)) {
    fs.symlinkSync(outsideDir, symlinkPath, 'junction');
  }

  // --- EJECUCIÓN DE TESTS ---

  // 1. Lectura fuera del proyecto (Path Traversal clásico)
  const res1 = readFileTool('../test_outside/secret.txt');
  assert.match(res1, /Bloqueado: Intento de acceso fuera/);
  console.log("✅ Lectura fuera del proyecto bloqueada");

  // 2. Escritura absoluta fuera del proyecto
  const absoluteOut = path.join(outsideDir, 'hacked.txt');
  const res2 = writeFileTool(absoluteOut, 'hack');
  assert.match(res2, /Bloqueado: Intento de acceso fuera/);
  console.log("✅ Escritura absoluta fuera del proyecto bloqueada");

  // 3. Ataque de prefijo de directorio (ej. proyecto-malicioso)
  const prefixPath = projectRoot + '-malicioso/archivo.txt';
  const res3 = readFileTool(prefixPath);
  assert.match(res3, /Bloqueado: Intento de acceso fuera/);
  console.log("✅ Ataque de prefijo bloqueado");

 // 4. Acceso a .git
  const res4 = readFileTool('test_env/.git/config');
  assert.match(res4, /Bloqueado: No se permite operar sobre \.git/);

  // 5. Acceso a .env
  const res5 = readFileTool('test_env/.env');
  assert.match(res5, /Acceso denegado a credenciales/);
  console.log("✅ Acceso a .env bloqueado");

  // 6. Symlink/Junction hacia afuera (Escritura en directorio no existente aún)
  const res6 = writeFileTool('test_env/fake_dir/nuevo_archivo.txt', 'hack');
  assert.match(res6, /Bloqueado: El enlace simbólico apunta fuera/);
  console.log("✅ Symlink traversal bloqueado");

  // 7. Comando válido
  const res7 = runCommandTool('echo test_valido');
  assert.match(res7, /test_valido/);
  console.log("✅ Comando válido ejecutado");

 // 8. Comando destructivo
  const res8 = runCommandTool('rmdir /S /Q node_modules');
  assert.match(res8, /bloqueado: Contiene operaciones destructivas/); // <-- 'b' minúscula
  console.log("✅ Comando destructivo bloqueado");

  // 9. Comando encadenado (Bypass cmd)
  const res9 = runCommandTool('echo hola & del package.json');
  assert.match(res9, /bloqueado: Contiene operaciones destructivas/); // <-- 'b' minúscula
  console.log("✅ Comando encadenado malicioso bloqueado");

  // 10. Archivo grande (Truncado)
  const largeText = 'A'.repeat(5000);
  fs.writeFileSync(path.join(testDir, 'large.txt'), largeText);
  const res10 = readFileTool('test_env/large.txt');
  assert.match(res10, /Contenido truncado: mostrando 3000/);
  assert.strictEqual(res10.length < 3200, true);
  console.log("✅ Archivo gigante truncado correctamente");

  // 11. Archivo .ia gigante (NUNCA Truncar)
  const iaDir = path.join(projectRoot, '.ia');
  if (!fs.existsSync(iaDir)) fs.mkdirSync(iaDir);
  fs.writeFileSync(path.join(iaDir, 'rules.md'), largeText);
  const res11 = readFileTool('.ia/rules.md');
  assert.doesNotMatch(res11, /Contenido truncado/);
  assert.strictEqual(res11.length, 5000);
  console.log("✅ Memoria .ia/ NUNCA se trunca (Íntegra)");

  // --- CLEANUP ---
 // --- CLEANUP ---
  fs.rmSync(testDir, { recursive: true, force: true });
  fs.rmSync(outsideDir, { recursive: true, force: true });
  fs.unlinkSync(path.join(iaDir, 'rules.md'));

  console.log("\n🚀 Todos los tests de seguridad superados.");
};

runTests();

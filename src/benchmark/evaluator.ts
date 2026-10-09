import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface BenchmarkAssertions {
  mustMention?: string[];
  mustMentionFiles?: string[];
  mustNotModifyFiles?: boolean;
  file?: string;
  expectedContent?: string;
  expectedMathImplementation?: string;
  testCommandMustPass?: boolean;
}

export interface AcceptanceResult {
  passed: boolean;
  failures: string[];
}

export type WorkspaceSnapshot = Readonly<Record<string, string>>;

const walkFiles = (root: string, current = root, files: Record<string, string> = {}): Record<string, string> => {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (entry.name === 'run.json') {
      continue;
    }
    const entryPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      walkFiles(root, entryPath, files);
      continue;
    }
    if (entry.isFile()) {
      const relativePath = path.relative(root, entryPath).replace(/\\/g, '/');
      files[relativePath] = crypto
        .createHash('sha256')
        .update(fs.readFileSync(entryPath))
        .digest('hex');
    }
  }
  return files;
};

export const snapshotWorkspace = (workspacePath: string): WorkspaceSnapshot =>
  walkFiles(workspacePath);

const snapshotsEqual = (left: WorkspaceSnapshot, right: WorkspaceSnapshot): boolean => {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key]);
};

export const evaluateBenchmarkAssertions = (
  assertions: BenchmarkAssertions,
  workspacePath: string,
  output: string,
  before: WorkspaceSnapshot,
): AcceptanceResult => {
  const failures: string[] = [];

  for (const text of assertions.mustMention ?? []) {
    if (!output.includes(text)) {
      failures.push(`La respuesta no menciona '${text}'.`);
    }
  }

  for (const fileName of assertions.mustMentionFiles ?? []) {
    if (!output.replace(/\\/g, '/').includes(fileName)) {
      failures.push(`La respuesta no menciona '${fileName}'.`);
    }
  }

  if (assertions.mustNotModifyFiles && !snapshotsEqual(before, snapshotWorkspace(workspacePath))) {
    failures.push('La tarea de solo lectura modificó archivos del workspace.');
  }

  if (assertions.file && assertions.expectedContent !== undefined) {
    const filePath = path.join(workspacePath, assertions.file);
    if (!fs.existsSync(filePath)) {
      failures.push(`No se creó o modificó el archivo esperado: ${assertions.file}.`);
    } else if (fs.readFileSync(filePath, 'utf-8') !== assertions.expectedContent) {
      failures.push(`El contenido de ${assertions.file} no coincide con la aserción.`);
    }
  }

  if (assertions.expectedMathImplementation) {
    const mathPath = path.join(workspacePath, 'math.ts');
    const mathContent = fs.existsSync(mathPath) ? fs.readFileSync(mathPath, 'utf-8') : '';
    if (!/return\s+a\s*\*\s*b\s*;/.test(mathContent)) {
      failures.push('math.ts no implementa multiply como a * b.');
    }
  }

  return { passed: failures.length === 0, failures };
};

import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import {
  BenchmarkAssertions,
  evaluateBenchmarkAssertions,
  snapshotWorkspace,
} from "../src/benchmark/evaluator";
import { loadConfig } from "../src/config/env";

const root = process.cwd();

const tasks = [
  "01-read-file",
  "02-modify-function",
  "03-create-file",
  "04-find-usages",
  "05-fix-test",
];

const runsDir = path.join(root, "benchmarks", "runs");

fs.mkdirSync(runsDir, { recursive: true });

type RunStatus =
  | "success"
  | "failure"
  | "provider_error"
  | "max_iterations"
  | "verification_failed"
  | "unverified"
  | "acceptance_failed"
  | "process_error";

interface RunMetrics {
  iterations?: number;
  toolCalls?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  estimated?: boolean;
}

interface AcceptanceMetadata {
  passed: boolean;
  failures: string[];
}

interface PublicConfiguration {
  maxIterations: number;
  contextMaxTokens?: number;
  verificationMaxCycles: number;
}

interface RunMetadata {
  runId: string;
  taskId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  status: RunStatus;
  mode: "read_only" | "edit";
  provider?: string;
  model?: string;
  commit?: string;
  configuration?: PublicConfiguration;
  verificationStatus?: "not_needed" | "passed" | "failed" | "unavailable";
  metrics: RunMetrics;
  acceptance: AcceptanceMetadata;
  workspace: string;
  stdout: string;
  stderr: string;
}

function extractNumber(
  output: string,
  pattern: RegExp,
): number | undefined {
  const match = output.match(pattern);

  if (!match) {
    return undefined;
  }

  const value = Number(match[1]);

  return Number.isFinite(value) ? value : undefined;
}

function extractMetrics(output: string): RunMetrics {
  const inputTokens = extractNumber(
    output,
    /Input tokens \(acumulados\):\s*(\d+)/,
  );
  const outputTokens = extractNumber(
    output,
    /Output tokens \(acumulados\):\s*(\d+)/,
  );
  return {
    iterations: extractNumber(
      output,
      /Iteraciones:\s*(\d+)/,
    ),

    toolCalls: extractNumber(
      output,
      /Tool calls:\s*(\d+)/,
    ),

    inputTokens,

    outputTokens,

    totalTokens: extractNumber(
      output,
      /Total tokens:\s*(\d+)/,
    ),

    latencyMs: extractNumber(
      output,
      /Latencia total:\s*(\d+)\s*ms/,
    ),

    ...(inputTokens !== undefined || outputTokens !== undefined
      ? { estimated: output.includes("Origen datos: Estimación local o mixta") }
      : {}),
  };
}

function getPublicConfiguration(): PublicConfiguration | undefined {
  try {
    const config = loadConfig();
    return {
      maxIterations: config.maxIter,
      ...(config.contextMaxTokens === undefined
        ? {}
        : { contextMaxTokens: config.contextMaxTokens }),
      verificationMaxCycles: config.verificationMaxCycles,
    };
  } catch {
    return undefined;
  }
}

function getVerificationStatus(
  output: string,
): RunMetadata["verificationStatus"] {
  const match = output.match(/Estado de verificación:\s*(\w+)/);
  if (!match) {
    return undefined;
  }

  const status = match[1];
  return status === "not_needed" || status === "passed" || status === "failed" || status === "unavailable"
    ? status
    : undefined;
}

function getCommit(): string | undefined {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  });
  const commit = result.stdout?.trim();
  return result.status === 0 && commit ? commit : undefined;
}

function getEffectiveModel(output: string): { provider?: string; model?: string } {
  const match = output.match(/Motor iniciado:\s*([^()]+)\s*\(([^)]+)\)/);
  return match
    ? { provider: match[1].trim(), model: match[2].trim() }
    : {};
}

function runRequiredFixtureTests(
  workspacePath: string,
  assertions: BenchmarkAssertions,
): string[] {
  if (!assertions.testCommandMustPass) {
    return [];
  }

  const testFile = path.join(workspacePath, "math.test.ts");
  const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
  if (!fs.existsSync(testFile) || !fs.existsSync(tsxCli)) {
    return ["No se pudo localizar el ejecutor o la prueba requerida por la fixture."];
  }

  const result = spawnSync(process.execPath, [tsxCli, testFile], {
    cwd: workspacePath,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error || result.status !== 0) {
    const details = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
    return [
      `La prueba requerida por la fixture falló${details ? `: ${details}` : "."}`,
    ];
  }

  return [];
}

function determineStatus(
  output: string,
  exitCode: number | null,
  processError: boolean,
): RunStatus {
  if (processError) {
    return "process_error";
  }

  if (
    output.includes("[Error Crítico]") ||
    output.includes("fetch failed")
  ) {
    return "provider_error";
  }

  if (
    output.includes(
      "Se alcanzó el límite estricto de 5 iteraciones",
    )
  ) {
    return "max_iterations";
  }

  if (output.includes("La verificación no se completó correctamente.")) {
    return "verification_failed";
  }

  if (exitCode === 2) {
    return "unverified";
  }

  if (exitCode !== 0 && exitCode !== null) {
    return "failure";
  }

  return "success";
}

let failedRuns = 0;

for (const task of tasks) {
  console.log("\n================================");
  console.log(`TASK: ${task}`);
  console.log("================================\n");

  const taskDir = path.join(
    root,
    "benchmarks",
    "tasks",
    task,
  );

  const workspaceSource = path.join(
    taskDir,
    "workspace",
  );

  const taskFile = path.join(
    taskDir,
    "task.md",
  );

  if (!fs.existsSync(taskFile)) {
    console.error(
      `❌ No existe task.md para ${task}`,
    );

    failedRuns++;
    continue;
  }

  if (!fs.existsSync(workspaceSource)) {
    console.error(
      `❌ No existe workspace para ${task}`,
    );

    failedRuns++;
    continue;
  }

  const taskText = fs.readFileSync(
    taskFile,
    "utf8",
  ).trim();

  if (!taskText) {
    console.error(
      `❌ ${task}: task.md está vacío`,
    );

    failedRuns++;
    continue;
  }

  const assertionsFile = path.join(taskDir, "expected", "assertions.json");
  let assertions: BenchmarkAssertions;
  try {
    assertions = JSON.parse(fs.readFileSync(assertionsFile, "utf8")) as BenchmarkAssertions;
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`No se pudieron leer las aserciones de ${task}: ${reason}`);
    failedRuns++;
    continue;
  }

  const runId = `${task}-${Date.now()}`;

  const workspaceDir = path.join(
    runsDir,
    runId,
  );

  fs.cpSync(
    workspaceSource,
    workspaceDir,
    {
      recursive: true,
    },
  );

  console.log(
    `Workspace: ${workspaceDir}`,
  );

  const before = snapshotWorkspace(workspaceDir);
  const mode = assertions.mustNotModifyFiles ? "read_only" : "edit";

  const startedAt = new Date();
  const startedAtMs = performance.now();

  const result = spawnSync(
    process.execPath,
    [
      "-r",
      "tsx/cjs",
      path.join(root, "src", "index.ts"),
      "--mode",
      mode === "read_only" ? "read-only" : "edit",
      taskText,
    ],
    {
      cwd: workspaceDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const finishedAt = new Date();
  const durationMs = Math.round(
    performance.now() - startedAtMs,
  );

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";

  const combinedOutput = `${stdout}\n${stderr}`;

  // Reproducimos la salida del agente en la consola.
  if (stdout) {
    process.stdout.write(stdout);
  }

  if (stderr) {
    process.stderr.write(stderr);
  }

  const processError = Boolean(result.error);

  const status = determineStatus(
    combinedOutput,
    result.status,
    processError,
  );

  const metrics = extractMetrics(
    combinedOutput,
  );
  const effectiveModel = getEffectiveModel(combinedOutput);
  const baseAcceptance = evaluateBenchmarkAssertions(
    assertions,
    workspaceDir,
    combinedOutput,
    before,
  );
  const fixtureTestFailures = runRequiredFixtureTests(workspaceDir, assertions);
  const acceptance: AcceptanceMetadata = {
    passed: baseAcceptance.passed && fixtureTestFailures.length === 0,
    failures: [...baseAcceptance.failures, ...fixtureTestFailures],
  };
  const finalStatus = status === "success" && !acceptance.passed
    ? "acceptance_failed"
    : status;

  const runMetadata: RunMetadata = {
    runId,
    taskId: task,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
    exitCode: result.status,
    signal: result.signal,
    status: finalStatus,
    mode,
    ...effectiveModel,
    commit: getCommit(),
    configuration: getPublicConfiguration(),
    verificationStatus: getVerificationStatus(combinedOutput),
    metrics,
    acceptance,
    workspace: workspaceDir,
    stdout,
    stderr,
  };

  fs.writeFileSync(
    path.join(workspaceDir, "run.json"),
    JSON.stringify(
      runMetadata,
      null,
      2,
    ),
  );

  console.log("\n--------------------------------");
  console.log(`STATUS: ${finalStatus}`);

  if (metrics.iterations !== undefined) {
    console.log(
      `Iterations: ${metrics.iterations}`,
    );
  }

  if (metrics.toolCalls !== undefined) {
    console.log(
      `Tool calls: ${metrics.toolCalls}`,
    );
  }

  if (metrics.inputTokens !== undefined) {
    console.log(
      `Input tokens: ${metrics.inputTokens}`,
    );
  }

  if (metrics.outputTokens !== undefined) {
    console.log(
      `Output tokens: ${metrics.outputTokens}`,
    );
  }

  if (metrics.totalTokens !== undefined) {
    console.log(
      `Total tokens: ${metrics.totalTokens}`,
    );
  }

  if (metrics.latencyMs !== undefined) {
    console.log(
      `Agent latency: ${metrics.latencyMs} ms`,
    );
  }

  console.log(
    `Runner duration: ${durationMs} ms`,
  );

  if (!acceptance.passed) {
    console.log("Acceptance failures:");
    for (const failure of acceptance.failures) {
      console.log(`- ${failure}`);
    }
  }

  if (finalStatus === "success") {
    console.log(`${task} completada.`);
  } else {
    console.log(
      `${task} terminó con estado: ${finalStatus}`,
    );

    failedRuns++;
  }

  console.log("--------------------------------\n");
}

console.log("\n================================");
console.log("BENCHMARK SUMMARY");
console.log("================================\n");

console.log(
  `Tasks: ${tasks.length}`,
);

console.log(
  `Failed: ${failedRuns}`,
);

console.log(
  `Successful: ${tasks.length - failedRuns}`,
);

if (failedRuns > 0) {
  process.exitCode = 1;
} else {
  process.exitCode = 0;
}

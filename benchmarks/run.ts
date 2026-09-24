import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

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
  | "process_error";

interface RunMetrics {
  iterations?: number;
  toolCalls?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
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
  metrics: RunMetrics;
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
  return {
    iterations: extractNumber(
      output,
      /Iteraciones:\s*(\d+)/,
    ),

    toolCalls: extractNumber(
      output,
      /Tool calls:\s*(\d+)/,
    ),

    inputTokens: extractNumber(
      output,
      /Input tokens \(acumulados\):\s*(\d+)/,
    ),

    outputTokens: extractNumber(
      output,
      /Output tokens \(acumulados\):\s*(\d+)/,
    ),

    totalTokens: extractNumber(
      output,
      /Total tokens:\s*(\d+)/,
    ),

    latencyMs: extractNumber(
      output,
      /Latencia total:\s*(\d+)\s*ms/,
    ),
  };
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
    `📁 Workspace: ${workspaceDir}`,
  );

  const startedAt = new Date();
  const startedAtMs = performance.now();

  const result = spawnSync(
    process.execPath,
    [
      "-r",
      "tsx/cjs",
      path.join(root, "src", "index.ts"),
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

  const runMetadata: RunMetadata = {
    runId,
    taskId: task,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
    exitCode: result.status,
    signal: result.signal,
    status,
    metrics,
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
  console.log(`STATUS: ${status}`);

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

  if (status === "success") {
    console.log(`✅ ${task} completada.`);
  } else {
    console.log(
      `❌ ${task} terminó con estado: ${status}`,
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
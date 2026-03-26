import { exec } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/db";

const WORKSPACE = process.env.WORKSPACE_PATH || "/var/www/atlas-workspace";
const PYTHON = process.env.PYTHON_VENV || "/var/www/atlas-workspace/.venv/bin/python3";
const SANDBOX = path.join(WORKSPACE, "sandbox");
const PYTHON_TIMEOUT = 120_000;
const SHELL_TIMEOUT = 60_000;

// SECURITY: All paths must resolve inside workspace
function safePath(relativePath: string): string {
  const resolved = path.resolve(WORKSPACE, relativePath);
  if (!resolved.startsWith(WORKSPACE)) {
    throw new Error("Path traversal blocked: " + relativePath);
  }
  return resolved;
}

// SECURITY: Block dangerous shell commands
const BLOCKED_COMMANDS = [
  "sudo",
  "rm -rf /",
  "chmod 777",
  "mkfs",
  "dd if=",
  "> /dev/",
  "shutdown",
  "reboot",
  "systemctl",
  "service ",
  "crontab",
  "passwd",
  "useradd",
  "usermod",
  "curl|bash",
  "wget|bash",
  "nohup",
  "&disown",
  "screen ",
  "tmux ",
];

function validateShellCommand(cmd: string): void {
  for (const b of BLOCKED_COMMANDS) {
    if (cmd.toLowerCase().includes(b.toLowerCase())) {
      throw new Error(`Blocked command pattern: ${b}`);
    }
  }
  if (cmd.includes("..") && !cmd.includes("pip")) {
    throw new Error("Path traversal in shell command blocked");
  }
}

function execPromise(
  command: string,
  timeout: number
): Promise<{ stdout: string; stderr: string; error?: string }> {
  return new Promise((resolve) => {
    exec(
      command,
      { timeout, maxBuffer: 10 * 1024 * 1024, cwd: WORKSPACE },
      (error, stdout, stderr) => {
        resolve({
          stdout: stdout?.slice(0, 50000) || "",
          stderr: stderr?.slice(0, 10000) || "",
          error: error?.message,
        });
      }
    );
  });
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ result: string; success: boolean }> {
  const startTime = Date.now();
  let result = "";
  let success = true;

  try {
    switch (name) {
      case "execute_python": {
        await fs.mkdir(SANDBOX, { recursive: true });
        const scriptPath = path.join(SANDBOX, `run_${Date.now()}.py`);
        await fs.writeFile(scriptPath, input.script as string);
        const out = await execPromise(`${PYTHON} ${scriptPath}`, PYTHON_TIMEOUT);
        success = !out.error;
        result = JSON.stringify(out);
        break;
      }

      case "write_file": {
        const filePath = safePath(input.path as string);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, input.content as string, "utf-8");
        result = JSON.stringify({
          success: true,
          path: input.path,
          bytes: Buffer.byteLength(input.content as string),
        });
        break;
      }

      case "read_file": {
        const filePath = safePath(input.path as string);
        const content = await fs.readFile(filePath, "utf-8");
        result = content.slice(0, 100000);
        break;
      }

      case "list_directory": {
        const dirPath = safePath((input.path as string) || ".");
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        result = JSON.stringify(
          entries.map((e) => ({
            name: e.name,
            type: e.isDirectory() ? "dir" : "file",
          }))
        );
        break;
      }

      case "execute_shell": {
        validateShellCommand(input.command as string);
        const out = await execPromise(
          `cd ${WORKSPACE} && ${input.command}`,
          SHELL_TIMEOUT
        );
        success = !out.error;
        result = JSON.stringify(out);
        break;
      }

      case "create_task": {
        const task = await prisma.task.create({
          data: {
            title: input.title as string,
            description: (input.description as string) || "",
            type: input.type as string,
            status: input.requires_approval ? "pending" : "approved",
            proposedBy: "atlas_ai",
          },
        });
        result = JSON.stringify({
          success: true,
          taskId: task.id,
          status: task.status,
        });
        break;
      }

      case "update_strategy": {
        const strategy = await prisma.strategy.update({
          where: { slug: input.slug as string },
          data: input.updates as Record<string, unknown>,
        });
        result = JSON.stringify({ success: true, slug: strategy.slug });
        break;
      }

      case "create_hypothesis": {
        const hyp = await prisma.hypothesis.create({
          data: {
            title: input.title as string,
            category: input.category as string,
            thesis: input.thesis as string,
            economicRationale: input.economicRationale as string,
            persistenceArgument: (input.persistenceArgument as string) || null,
            dataRequirements: (input.dataRequirements as string) || null,
            expectedCharacteristics:
              (input.expectedCharacteristics as string) || null,
            killCriteria: input.killCriteria as string,
            retailEdgeClass: (input.retailEdgeClass as string) || null,
            benchmark: (input.benchmark as string) || null,
          },
        });
        // Update stats
        const state = await prisma.projectState.findFirst({ where: { id: 1 } });
        const stats = (state?.stats as Record<string, number>) || {};
        await prisma.projectState.update({
          where: { id: 1 },
          data: {
            stats: {
              ...stats,
              hypothesesGenerated: (stats.hypothesesGenerated || 0) + 1,
            },
          },
        });
        result = JSON.stringify({ success: true, id: hyp.id });
        break;
      }

      case "update_state_document": {
        const statePath = path.join(WORKSPACE, "state.md");
        await fs.writeFile(statePath, input.content as string, "utf-8");
        result = JSON.stringify({ success: true });
        break;
      }

      case "log_activity": {
        await prisma.activityLog.create({
          data: {
            event: input.event as string,
            type: input.type as string,
          },
        });
        result = JSON.stringify({ success: true });
        break;
      }

      default:
        success = false;
        result = JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err: unknown) {
    success = false;
    result = JSON.stringify({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }

  // Log every execution
  const durationMs = Date.now() - startTime;
  await prisma.executionLog
    .create({
      data: {
        tool: name,
        input: JSON.parse(JSON.stringify(input)),
        output: result.slice(0, 50000),
        success,
        durationMs,
      },
    })
    .catch(() => {}); // Don't fail the tool if logging fails

  return { result, success };
}

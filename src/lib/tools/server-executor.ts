import { exec } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/db";

const SHELL_TIMEOUT = 120_000;

function execPromise(
  command: string,
  timeout: number
): Promise<{ stdout: string; stderr: string; error?: string }> {
  return new Promise((resolve) => {
    exec(
      command,
      { timeout, maxBuffer: 10 * 1024 * 1024 },
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

export async function executeServerTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ result: string; success: boolean }> {
  const startTime = Date.now();
  let result = "";
  let success = true;

  try {
    switch (name) {
      case "run_shell_command": {
        const out = await execPromise(input.command as string, SHELL_TIMEOUT);
        success = !out.error;
        result = JSON.stringify(out);
        break;
      }

      case "server_write_file": {
        const filePath = input.path as string;
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, input.content as string, "utf-8");
        result = JSON.stringify({
          success: true,
          path: filePath,
          bytes: Buffer.byteLength(input.content as string),
        });
        break;
      }

      case "server_read_file": {
        const filePath = input.path as string;
        const content = await fs.readFile(filePath, "utf-8");
        result = content.slice(0, 100000);
        break;
      }

      default:
        success = false;
        result = JSON.stringify({ error: `Unknown server tool: ${name}` });
    }
  } catch (err: unknown) {
    success = false;
    result = JSON.stringify({
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Log execution
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
    .catch(() => {});

  // Also log to activity log for visibility
  await prisma.activityLog
    .create({
      data: {
        event: `Server tool: ${name} — ${success ? "success" : "failed"} (${durationMs}ms)`,
        type: "system",
      },
    })
    .catch(() => {});

  return { result, success };
}

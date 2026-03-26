import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const WORKSPACE = process.env.WORKSPACE_PATH || "/var/www/atlas-workspace";

function safePath(relativePath: string): string {
  const resolved = path.resolve(WORKSPACE, relativePath);
  if (!resolved.startsWith(WORKSPACE)) {
    throw new Error("Path traversal blocked");
  }
  return resolved;
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const filePath = url.searchParams.get("path");
    if (!filePath) {
      return NextResponse.json({ error: "Path required" }, { status: 400 });
    }

    const absPath = safePath(filePath);
    const stat = await fs.stat(absPath);

    if (stat.size > 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large (>1MB)" },
        { status: 400 }
      );
    }

    const content = await fs.readFile(absPath, "utf-8");
    const ext = path.extname(filePath).slice(1);

    return NextResponse.json({
      path: filePath,
      content,
      size: stat.size,
      extension: ext,
      modified: stat.mtime.toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg.includes("ENOENT")) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const filePath = url.searchParams.get("path");
    if (!filePath) {
      return NextResponse.json({ error: "Path required" }, { status: 400 });
    }

    const absPath = safePath(filePath);
    await fs.unlink(absPath);

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

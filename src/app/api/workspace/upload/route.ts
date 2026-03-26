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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const directory = (formData.get("directory") as string) || ".";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const dirPath = safePath(directory);
    await fs.mkdir(dirPath, { recursive: true });

    const filePath = path.join(dirPath, file.name);
    // Verify the final path is still within workspace
    if (!filePath.startsWith(WORKSPACE)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    return NextResponse.json({
      success: true,
      path: path.relative(WORKSPACE, filePath),
      size: buffer.length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

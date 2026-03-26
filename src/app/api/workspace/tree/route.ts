import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const WORKSPACE = process.env.WORKSPACE_PATH || "/var/www/atlas-workspace";

interface TreeEntry {
  name: string;
  type: "file" | "dir";
  path: string;
  children?: TreeEntry[];
}

async function buildTree(dirPath: string, relativePath: string = "", depth: number = 0): Promise<TreeEntry[]> {
  if (depth > 5) return []; // Limit depth

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const result: TreeEntry[] = [];

    for (const entry of entries) {
      // Skip hidden files, __pycache__, .venv, node_modules
      if (entry.name.startsWith(".") || entry.name === "__pycache__" || entry.name === "node_modules") continue;

      const entryRelPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        const children = await buildTree(
          path.join(dirPath, entry.name),
          entryRelPath,
          depth + 1
        );
        result.push({ name: entry.name, type: "dir", path: entryRelPath, children });
      } else {
        result.push({ name: entry.name, type: "file", path: entryRelPath });
      }
    }

    return result.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const tree = await buildTree(WORKSPACE);
    return NextResponse.json(tree);
  } catch (error) {
    console.error("Workspace tree error:", error);
    return NextResponse.json({ error: "Failed to read workspace" }, { status: 500 });
  }
}

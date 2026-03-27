import { NextRequest, NextResponse } from "next/server";
import { executeServerTool } from "@/lib/tools/server-executor";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Auth check — middleware handles session validation,
    // but verify cookie exists as safety net
    const session = request.cookies.get("atlas-session")?.value;
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { tool, input, approved } = body;

    if (!tool || !input) {
      return NextResponse.json(
        { error: "Missing tool or input" },
        { status: 400 }
      );
    }

    // If rejected, return without executing
    if (approved === false) {
      return NextResponse.json({
        result: "User rejected this action",
        success: false,
      });
    }

    // Execute the server tool
    const { result, success } = await executeServerTool(tool, input);

    return NextResponse.json({ result, success });
  } catch (error) {
    console.error("Atlas execute error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

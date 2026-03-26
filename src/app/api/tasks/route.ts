import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const type = url.searchParams.get("type");

    const where: Record<string, string> = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(tasks);
  } catch (error) {
    console.error("Tasks GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const task = await prisma.task.create({
      data: {
        title: body.title,
        description: body.description || null,
        type: body.type || "research",
        priority: body.priority || 0,
        proposedBy: body.proposedBy || "user",
      },
    });

    await prisma.activityLog.create({
      data: {
        event: `Task created: ${task.title}`,
        type: "system",
        metadata: { taskId: task.id, proposedBy: task.proposedBy },
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Tasks POST error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

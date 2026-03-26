import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const taskId = parseInt(id);

    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.result !== undefined && { result: body.result }),
        ...(body.title && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.priority !== undefined && { priority: body.priority }),
      },
    });

    // Log status changes
    if (body.status) {
      const typeMap: Record<string, string> = {
        approved: "approval",
        rejected: "rejection",
        completed: "milestone",
      };
      await prisma.activityLog.create({
        data: {
          event: `Task ${body.status}: ${task.title}`,
          type: typeMap[body.status] || "system",
          metadata: { taskId: task.id },
        },
      });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("Task PUT error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.task.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Task DELETE error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

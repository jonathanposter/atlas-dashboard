import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.activityLog.count(),
    ]);

    return NextResponse.json({ logs, total, limit, offset });
  } catch (error) {
    console.error("Log GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const log = await prisma.activityLog.create({
      data: {
        event: body.event,
        type: body.type || "system",
        metadata: body.metadata || null,
      },
    });
    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error("Log POST error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const strategies = await prisma.strategy.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(strategies);
  } catch (error) {
    console.error("Strategies GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const slug =
      body.slug ||
      body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const strategy = await prisma.strategy.create({
      data: {
        name: body.name,
        slug,
        category: body.category,
        pipelineStage: body.pipelineStage || 0,
        hypothesis: body.hypothesis || null,
        killCriteria: body.killCriteria || null,
      },
    });

    await prisma.activityLog.create({
      data: {
        event: `Strategy created: ${strategy.name}`,
        type: "milestone",
        metadata: { strategyId: strategy.id, category: strategy.category },
      },
    });

    return NextResponse.json(strategy, { status: 201 });
  } catch (error) {
    console.error("Strategies POST error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

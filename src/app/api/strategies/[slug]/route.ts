import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const strategy = await prisma.strategy.findUnique({ where: { slug } });
    if (!strategy) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(strategy);
  } catch (error) {
    console.error("Strategy GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();

    const strategy = await prisma.strategy.update({
      where: { slug },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.category && { category: body.category }),
        ...(body.pipelineStage !== undefined && { pipelineStage: body.pipelineStage }),
        ...(body.hypothesis !== undefined && { hypothesis: body.hypothesis }),
        ...(body.killCriteria !== undefined && { killCriteria: body.killCriteria }),
        ...(body.scorecard !== undefined && { scorecard: body.scorecard }),
        ...(body.backtestResults !== undefined && { backtestResults: body.backtestResults }),
        ...(body.wfaResults !== undefined && { wfaResults: body.wfaResults }),
        ...(body.liveMetrics !== undefined && { liveMetrics: body.liveMetrics }),
        ...(body.status && { status: body.status }),
        ...(body.killReason !== undefined && { killReason: body.killReason }),
      },
    });

    if (body.pipelineStage !== undefined) {
      await prisma.activityLog.create({
        data: {
          event: `Strategy ${strategy.name} advanced to stage ${body.pipelineStage}`,
          type: "milestone",
        },
      });
    }

    return NextResponse.json(strategy);
  } catch (error) {
    console.error("Strategy PUT error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

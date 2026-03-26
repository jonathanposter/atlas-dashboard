import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const hypothesis = await prisma.hypothesis.update({
      where: { id: parseInt(id) },
      data: {
        ...(body.title && { title: body.title }),
        ...(body.category && { category: body.category }),
        ...(body.thesis && { thesis: body.thesis }),
        ...(body.economicRationale && { economicRationale: body.economicRationale }),
        ...(body.persistenceArgument !== undefined && {
          persistenceArgument: body.persistenceArgument,
        }),
        ...(body.dataRequirements !== undefined && {
          dataRequirements: body.dataRequirements,
        }),
        ...(body.expectedCharacteristics !== undefined && {
          expectedCharacteristics: body.expectedCharacteristics,
        }),
        ...(body.killCriteria && { killCriteria: body.killCriteria }),
        ...(body.retailEdgeClass !== undefined && {
          retailEdgeClass: body.retailEdgeClass,
        }),
        ...(body.benchmark !== undefined && { benchmark: body.benchmark }),
        ...(body.status && { status: body.status }),
        ...(body.researchSources !== undefined && {
          researchSources: body.researchSources,
        }),
      },
    });

    // If killed, update stats
    if (body.status === "killed") {
      const state = await prisma.projectState.findFirst({ where: { id: 1 } });
      const stats = (state?.stats as Record<string, number>) || {};
      await prisma.projectState.update({
        where: { id: 1 },
        data: {
          stats: { ...stats, hypothesesKilled: (stats.hypothesesKilled || 0) + 1 },
        },
      });
    }

    if (body.status) {
      await prisma.activityLog.create({
        data: {
          event: `Hypothesis ${body.status}: ${hypothesis.title}`,
          type: body.status === "killed" ? "alert" : "milestone",
        },
      });
    }

    return NextResponse.json(hypothesis);
  } catch (error) {
    console.error("Hypothesis PUT error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

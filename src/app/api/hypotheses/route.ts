import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const hypotheses = await prisma.hypothesis.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(hypotheses);
  } catch (error) {
    console.error("Hypotheses GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const hypothesis = await prisma.hypothesis.create({
      data: {
        title: body.title,
        category: body.category,
        thesis: body.thesis,
        economicRationale: body.economicRationale,
        persistenceArgument: body.persistenceArgument || null,
        dataRequirements: body.dataRequirements || null,
        expectedCharacteristics: body.expectedCharacteristics || null,
        killCriteria: body.killCriteria,
        retailEdgeClass: body.retailEdgeClass || null,
        benchmark: body.benchmark || null,
        researchSources: body.researchSources || null,
      },
    });

    // Update stats
    const state = await prisma.projectState.findFirst({ where: { id: 1 } });
    const stats = (state?.stats as Record<string, number>) || {};
    await prisma.projectState.update({
      where: { id: 1 },
      data: {
        stats: { ...stats, hypothesesGenerated: (stats.hypothesesGenerated || 0) + 1 },
      },
    });

    await prisma.activityLog.create({
      data: {
        event: `Hypothesis created: ${hypothesis.title}`,
        type: "milestone",
        metadata: { hypothesisId: hypothesis.id, category: hypothesis.category },
      },
    });

    return NextResponse.json(hypothesis, { status: 201 });
  } catch (error) {
    console.error("Hypotheses POST error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

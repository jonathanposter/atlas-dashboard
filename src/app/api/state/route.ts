import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    let state = await prisma.projectState.findFirst({ where: { id: 1 } });
    if (!state) {
      state = await prisma.projectState.create({
        data: {
          currentPhase: 0,
          stats: {
            hypothesesGenerated: 0,
            hypothesesKilled: 0,
            strategiesInPipeline: 0,
            strategiesDeployed: 0,
          },
        },
      });
    }
    return NextResponse.json(state);
  } catch (error) {
    console.error("State GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const state = await prisma.projectState.upsert({
      where: { id: 1 },
      update: {
        ...(body.currentPhase !== undefined && { currentPhase: body.currentPhase }),
        ...(body.stats && { stats: body.stats }),
      },
      create: {
        currentPhase: body.currentPhase ?? 0,
        stats: body.stats ?? {},
      },
    });
    return NextResponse.json(state);
  } catch (error) {
    console.error("State PUT error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

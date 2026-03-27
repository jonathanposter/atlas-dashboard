import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encrypt";
import { ATLAS_MODEL } from "@/lib/constants";
import { PHASES } from "@/lib/atlas-prompt";

export const dynamic = "force-dynamic";

// GET — return current priorities (static + AI-generated)
export async function GET() {
  try {
    // Get stored priorities
    const stored = await prisma.priority.findMany({
      where: { completed: false },
      orderBy: { rank: "asc" },
    });

    // If we have stored priorities, return them
    if (stored.length > 0) {
      return NextResponse.json({ priorities: stored, source: "stored" });
    }

    // Otherwise generate static priorities from project state
    const priorities = await generateStaticPriorities();
    return NextResponse.json({ priorities, source: "static" });
  } catch (error) {
    console.error("Priorities GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST — generate AI priorities and store them
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const useAI = body.useAI !== false;

    if (!useAI) {
      // Just regenerate static priorities
      const priorities = await generateStaticPriorities();

      // Clear old and store new
      await prisma.priority.deleteMany({ where: { completed: false } });
      for (const p of priorities) {
        await prisma.priority.create({ data: p });
      }

      return NextResponse.json({ priorities, source: "static" });
    }

    // AI-generated priorities
    const apiKeySetting = await prisma.setting.findUnique({
      where: { key: "anthropic_api_key" },
    });

    if (!apiKeySetting) {
      // Fall back to static
      const priorities = await generateStaticPriorities();
      return NextResponse.json({ priorities, source: "static" });
    }

    const apiKey = decrypt(apiKeySetting.value);
    const context = await buildPriorityContext();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ATLAS_MODEL,
        max_tokens: 2048,
        system: `You are Atlas AI, the project manager for an algorithmic forex trading pipeline. Generate exactly 5 prioritised next actions based on the current project state. Be specific and actionable.

Respond ONLY with a JSON array. Each item must have:
- "title": short action title (max 60 chars)
- "description": one sentence on what to do
- "reason": why this is the highest priority right now
- "action": suggested dashboard page ("/research", "/pipeline", "/tasks", "/workspace", or null)

Order by priority. No markdown, no explanation — just the JSON array.`,
        messages: [
          {
            role: "user",
            content: `Current project state:\n${context}\n\nGenerate the top 5 priorities.`,
          },
        ],
      }),
    });

    const data = await response.json();

    if (data.error) {
      const priorities = await generateStaticPriorities();
      return NextResponse.json({ priorities, source: "static" });
    }

    const text =
      data.content?.[0]?.text || "[]";

    let aiPriorities: Array<{
      title: string;
      description: string;
      reason: string;
      action: string | null;
    }>;

    try {
      // Extract JSON from response (handle if wrapped in markdown)
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      aiPriorities = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      const priorities = await generateStaticPriorities();
      return NextResponse.json({ priorities, source: "static" });
    }

    // Clear old and store new AI priorities
    await prisma.priority.deleteMany({ where: { completed: false } });

    const stored = [];
    for (let i = 0; i < aiPriorities.length; i++) {
      const p = aiPriorities[i];
      const created = await prisma.priority.create({
        data: {
          title: p.title,
          description: p.description,
          reason: p.reason,
          action: p.action,
          source: "ai",
          rank: i,
        },
      });
      stored.push(created);
    }

    return NextResponse.json({ priorities: stored, source: "ai" });
  } catch (error) {
    console.error("Priorities POST error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PATCH — mark a priority as completed
export async function PATCH(request: NextRequest) {
  try {
    const { id } = await request.json();
    const updated = await prisma.priority.update({
      where: { id },
      data: { completed: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Priorities PATCH error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function generateStaticPriorities() {
  const state = await prisma.projectState.findFirst({ where: { id: 1 } });
  const stats = (state?.stats as Record<string, number>) || {};
  const phase = state?.currentPhase ?? 0;
  const hypothesesCount = await prisma.hypothesis.count();
  const strategiesCount = await prisma.strategy.count();
  const pendingTasks = await prisma.task.count({
    where: { status: "pending" },
  });

  const priorities: Array<{
    title: string;
    description: string;
    reason: string;
    action: string | null;
    source: string;
    rank: number;
  }> = [];

  // Phase-based priorities
  if (phase === 0) {
    if (hypothesesCount < 5) {
      priorities.push({
        title: "Research trading hypotheses",
        description: `Only ${hypothesesCount} hypotheses documented. Target 15-20 testable ideas across momentum, mean reversion, volatility, and structural categories.`,
        reason: "Phase 0 requires a robust hypothesis library before moving to algorithm construction.",
        action: "/research",
        source: "static",
        rank: priorities.length,
      });
    }
    if (stats.hypothesesGenerated === 0) {
      priorities.push({
        title: "Set up data acquisition",
        description: "Acquire 5-year tick data for EUR/USD, GBP/USD, USD/JPY from a reliable source.",
        reason: "Historical data is required for all backtesting and hypothesis validation.",
        action: "/workspace",
        source: "static",
        rank: priorities.length,
      });
    }
    priorities.push({
      title: "Select broker and tax structure",
      description: "Choose an ECN/STP, FCA-regulated broker with MT5 support. Decide between spread betting and CFD for tax efficiency.",
      reason: "Broker selection affects execution quality, costs, and available instruments.",
      action: null,
      source: "static",
      rank: priorities.length,
    });
  }

  if (phase >= 1 && strategiesCount === 0) {
    priorities.push({
      title: "Build first strategy",
      description: "Select the strongest hypothesis and develop an MQL5 Expert Advisor with modular architecture.",
      reason: "No strategies in the pipeline yet — need to start building to validate the process.",
      action: "/pipeline",
      source: "static",
      rank: priorities.length,
    });
  }

  if (pendingTasks > 0) {
    priorities.push({
      title: `Review ${pendingTasks} pending approval${pendingTasks > 1 ? "s" : ""}`,
      description: "Tasks are waiting for your approval before Atlas AI can proceed.",
      reason: "Blocked work — approvals gate pipeline progress.",
      action: "/tasks",
      source: "static",
      rank: 0, // Always top priority
    });
  }

  // Always suggest checking workspace state
  if (priorities.length < 5) {
    priorities.push({
      title: "Review project workspace",
      description: "Check current workspace files, scripts, and analysis outputs.",
      reason: "Staying aware of what's been built helps guide next decisions.",
      action: "/workspace",
      source: "static",
      rank: priorities.length,
    });
  }

  // Sort by rank
  priorities.sort((a, b) => a.rank - b.rank);
  return priorities.slice(0, 5);
}

async function buildPriorityContext(): Promise<string> {
  const state = await prisma.projectState.findFirst({ where: { id: 1 } });
  const stats = (state?.stats as Record<string, number>) || {};
  const phase = state?.currentPhase ?? 0;
  const phaseName = PHASES[phase]?.name || "Unknown";

  const hypotheses = await prisma.hypothesis.findMany();
  const strategies = await prisma.strategy.findMany();
  const pendingTasks = await prisma.task.count({ where: { status: "pending" } });
  const recentLogs = await prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return `Phase: ${phaseName}
Hypotheses: ${hypotheses.length} total (${hypotheses.filter((h) => h.status === "draft").length} draft, ${hypotheses.filter((h) => h.status === "approved").length} approved, ${hypotheses.filter((h) => h.status === "killed").length} killed)
Strategies: ${strategies.length} total (stages: ${strategies.map((s) => s.pipelineStage).join(", ") || "none"})
Stats: ${stats.hypothesesGenerated ?? 0} researched, ${stats.hypothesesKilled ?? 0} killed, ${stats.strategiesInPipeline ?? 0} in pipeline, ${stats.strategiesDeployed ?? 0} deployed
Pending approvals: ${pendingTasks}
Recent activity: ${recentLogs.map((l) => l.event).join("; ") || "None"}`;
}

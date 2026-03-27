import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encrypt";
import { ATLAS_SYSTEM_PROMPT } from "@/lib/atlas-prompt";
import { ATLAS_MODEL } from "@/lib/constants";

export async function POST(request: NextRequest) {
  try {
    const { strategySlug } = await request.json();

    const strategy = await prisma.strategy.findUnique({
      where: { slug: strategySlug },
    });
    if (!strategy) {
      return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
    }

    const apiKeySetting = await prisma.setting.findUnique({
      where: { key: "anthropic_api_key" },
    });
    if (!apiKeySetting) {
      return NextResponse.json(
        { error: "No API key configured" },
        { status: 400 }
      );
    }

    const apiKey = decrypt(apiKeySetting.value);

    const prompt = `Perform an adversarial review of this trading strategy:

Name: ${strategy.name}
Category: ${strategy.category}
Pipeline Stage: ${strategy.pipelineStage}
Hypothesis: ${strategy.hypothesis || "Not documented"}
Kill Criteria: ${strategy.killCriteria || "Not defined"}
Backtest Results: ${strategy.backtestResults ? JSON.stringify(strategy.backtestResults) : "Not available"}
WFA Results: ${strategy.wfaResults ? JSON.stringify(strategy.wfaResults) : "Not available"}

Be ruthlessly honest. Look for:
1. Overfitting indicators
2. Data snooping bias
3. Survivorship bias
4. Look-ahead bias
5. Unrealistic assumptions
6. Missing risk factors
7. Parameter sensitivity concerns
8. Regime dependency risks

Conclude with a clear PASS/CONCERN/FAIL recommendation with specific reasons.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ATLAS_MODEL,
        max_tokens: 4096,
        system: ATLAS_SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: err }, { status: response.status });
    }

    const data = await response.json();
    const content =
      data.content?.map((c: { type: string; text: string }) =>
        c.type === "text" ? c.text : ""
      ).join("") || "";

    await prisma.activityLog.create({
      data: {
        event: `Adversarial review completed: ${strategy.name}`,
        type: "ai",
        metadata: { strategyId: strategy.id },
      },
    });

    return NextResponse.json({ content, strategyName: strategy.name });
  } catch (error) {
    console.error("Review error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

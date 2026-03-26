import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encrypt";

export async function POST(request: NextRequest) {
  try {
    const { proposal } = await request.json();
    if (!proposal) {
      return NextResponse.json({ error: "Proposal required" }, { status: 400 });
    }

    // Check if cross-validation is enabled
    const cvSetting = await prisma.setting.findUnique({
      where: { key: "cross_validation_enabled" },
    });
    if (cvSetting?.value !== "true") {
      return NextResponse.json(
        { error: "Cross-validation is not enabled" },
        { status: 400 }
      );
    }

    const openaiKeySetting = await prisma.setting.findUnique({
      where: { key: "openai_api_key" },
    });
    if (!openaiKeySetting) {
      return NextResponse.json(
        { error: "No OpenAI API key configured for cross-validation" },
        { status: 400 }
      );
    }

    const openaiKey = decrypt(openaiKeySetting.value);

    const reviewPrompt = `You are an independent reviewer for an algorithmic trading project. Review this proposal for: blind spots, overconfidence, logical errors, overfitting risk, and anything the proposer might be wrong about. Be critical and specific.

Proposal:
${proposal}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: reviewPrompt }],
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: err }, { status: response.status });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    await prisma.activityLog.create({
      data: {
        event: "Cross-validation review completed",
        type: "ai",
        metadata: { model: "gpt-4" },
      },
    });

    return NextResponse.json({ critique: content });
  } catch (error) {
    console.error("Cross-validate error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

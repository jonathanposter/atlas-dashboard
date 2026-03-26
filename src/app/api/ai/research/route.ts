import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encrypt";
import { ATLAS_SYSTEM_PROMPT } from "@/lib/atlas-prompt";

export async function POST(request: NextRequest) {
  try {
    const { category, topic } = await request.json();

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

    const prompt = `Generate a comprehensive research brief for the following trading hypothesis category: ${category}${topic ? `. Focus area: ${topic}` : ""}.

Include:
1. Academic literature review (key papers and findings)
2. Market microstructure analysis
3. Historical pattern evidence
4. 3-5 specific testable hypotheses with kill criteria
5. Data requirements for validation
6. Potential retail edge angles

Format as a professional research document.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
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
        event: `Research brief generated: ${category}`,
        type: "ai",
        metadata: { category, topic },
      },
    });

    return NextResponse.json({ content });
  } catch (error) {
    console.error("Research error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

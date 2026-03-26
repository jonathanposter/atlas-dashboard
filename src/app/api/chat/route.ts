import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encrypt";
import { ATLAS_SYSTEM_PROMPT, PHASES } from "@/lib/atlas-prompt";
import { checkRateLimit } from "@/lib/rate-limit";
import { executeTool } from "@/lib/tools/executor";
import { ATLAS_TOOLS } from "@/lib/tools/definitions";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const messages = await prisma.chatMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    return NextResponse.json(messages.reverse());
  } catch (error) {
    console.error("Chat GET error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface ToolExecution {
  tool: string;
  description: string;
  success: boolean;
  outputPreview: string;
  timestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    if (!checkRateLimit()) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Max 30 messages per minute." },
        { status: 429 }
      );
    }

    const { message } = await request.json();
    if (!message?.trim()) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    // Get API key
    const apiKeySetting = await prisma.setting.findUnique({
      where: { key: "anthropic_api_key" },
    });
    if (!apiKeySetting) {
      return NextResponse.json(
        {
          error:
            "No API key configured. Add your Anthropic API key in Settings.",
        },
        { status: 400 }
      );
    }

    const apiKey = decrypt(apiKeySetting.value);

    // Save user message
    await prisma.chatMessage.create({
      data: { role: "user", content: message },
    });

    // Build state context
    const projectState = await prisma.projectState.findFirst({
      where: { id: 1 },
    });
    const stats = (projectState?.stats as Record<string, number>) || {};
    const recentTasks = await prisma.task.findMany({
      where: { status: "completed" },
      orderBy: { updatedAt: "desc" },
      take: 5,
    });
    const pendingCount = await prisma.task.count({
      where: { status: "pending" },
    });
    const recentLogs = await prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    const strategies = await prisma.strategy.findMany({
      where: { status: "active" },
      select: { name: true, pipelineStage: true },
    });

    // Read state document
    let stateDoc = "";
    try {
      stateDoc = await fs.readFile(
        (process.env.WORKSPACE_PATH || "/var/www/atlas-workspace") +
          "/state.md",
        "utf-8"
      );
    } catch {
      // state.md doesn't exist yet
    }

    const stateContext = `

[CURRENT PROJECT STATE]
Phase: ${PHASES[projectState?.currentPhase ?? 0]?.name ?? "Unknown"}
Active strategies: ${strategies.map((s) => `${s.name} (stage ${s.pipelineStage})`).join(", ") || "None"}
Pending tasks awaiting approval: ${pendingCount}
Recently completed: ${recentTasks.map((t) => t.title).join(", ") || "None"}
Key stats: ${stats.hypothesesGenerated ?? 0} hypotheses generated, ${stats.hypothesesKilled ?? 0} killed, ${stats.strategiesInPipeline ?? 0} in pipeline, ${stats.strategiesDeployed ?? 0} deployed
Last 5 log entries: ${recentLogs.map((l) => l.event).join("; ") || "None"}

[ATLAS STATE DOCUMENT]
${stateDoc}`;

    const systemPrompt = ATLAS_SYSTEM_PROMPT + stateContext;

    // Get conversation history (last 20 messages) - only text content for history
    const history = await prisma.chatMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const currentMessages: Array<{
      role: string;
      content: string | ContentBlock[];
    }> = history.reverse().map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // AGENTIC TOOL LOOP
    let finalText = "";
    const toolExecutions: ToolExecution[] = [];
    const MAX_ITERATIONS = 15;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
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
          system: systemPrompt,
          messages: currentMessages,
          tools: ATLAS_TOOLS,
        }),
      });

      const data = await response.json();

      if (data.error) {
        finalText += `\n\n**API Error**: ${data.error.message}`;
        break;
      }

      const textBlocks = (data.content || []).filter(
        (b: ContentBlock) => b.type === "text"
      );
      const toolUseBlocks = (data.content || []).filter(
        (b: ContentBlock) => b.type === "tool_use"
      );

      // Collect text
      if (textBlocks.length > 0) {
        finalText += textBlocks
          .map((b: ContentBlock) => b.text)
          .join("\n");
      }

      // If no tool calls, we're done
      if (toolUseBlocks.length === 0) break;

      // Execute each tool
      const toolResults: Array<{
        type: string;
        tool_use_id: string;
        content: string;
      }> = [];
      for (const toolUse of toolUseBlocks) {
        const { result, success } = await executeTool(
          toolUse.name!,
          toolUse.input as Record<string, unknown>
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id!,
          content: result,
        });
        toolExecutions.push({
          tool: toolUse.name!,
          description:
            (toolUse.input as Record<string, string>).description ||
            (toolUse.input as Record<string, string>).path ||
            (toolUse.input as Record<string, string>).command ||
            "",
          success,
          outputPreview: result.slice(0, 500),
          timestamp: new Date().toISOString(),
        });
      }

      // Feed results back to Claude for next iteration
      currentMessages.push({ role: "assistant", content: data.content });
      currentMessages.push({ role: "user", content: toolResults });

      // If stop_reason is "end_turn" and no more tool calls, we're done
      if (data.stop_reason === "end_turn" && toolUseBlocks.length === 0)
        break;
    }

    // Save AI response
    await prisma.chatMessage.create({
      data: {
        role: "assistant",
        content: finalText,
        metadata: JSON.parse(JSON.stringify({ toolExecutions })),
      },
    });

    await prisma.activityLog.create({
      data: {
        event: `AI response generated (${finalText.length} chars, ${toolExecutions.length} tool calls)`,
        type: "ai",
      },
    });

    return NextResponse.json({
      content: finalText,
      toolExecutions,
    });
  } catch (error) {
    console.error("Chat POST error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await prisma.chatMessage.deleteMany();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Chat DELETE error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

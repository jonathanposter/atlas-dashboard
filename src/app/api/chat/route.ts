import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encrypt";
import { ATLAS_SYSTEM_PROMPT, PHASES } from "@/lib/atlas-prompt";
import { checkRateLimit } from "@/lib/rate-limit";
import { executeTool } from "@/lib/tools/executor";
import { ATLAS_TOOLS } from "@/lib/tools/definitions";
import { SERVER_TOOLS } from "@/lib/tools/server-definitions";
import { executeServerTool } from "@/lib/tools/server-executor";
import { ATLAS_MODEL } from "@/lib/constants";

const SERVER_TOOL_NAMES = SERVER_TOOLS.map((t) => t.name);
const ALL_TOOLS = [...ATLAS_TOOLS, ...SERVER_TOOLS];

export const dynamic = "force-dynamic";

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

async function buildStateContext() {
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

  let stateDoc = "";
  try {
    stateDoc = await fs.readFile(
      (process.env.WORKSPACE_PATH || "/var/www/atlas-workspace") + "/state.md",
      "utf-8"
    );
  } catch {
    // state.md doesn't exist yet
  }

  return `

[CURRENT PROJECT STATE]
Phase: ${PHASES[projectState?.currentPhase ?? 0]?.name ?? "Unknown"}
Active strategies: ${strategies.map((s) => `${s.name} (stage ${s.pipelineStage})`).join(", ") || "None"}
Pending tasks awaiting approval: ${pendingCount}
Recently completed: ${recentTasks.map((t) => t.title).join(", ") || "None"}
Key stats: ${stats.hypothesesGenerated ?? 0} hypotheses generated, ${stats.hypothesesKilled ?? 0} killed, ${stats.strategiesInPipeline ?? 0} in pipeline, ${stats.strategiesDeployed ?? 0} deployed
Last 5 log entries: ${recentLogs.map((l) => l.event).join("; ") || "None"}

[ATLAS STATE DOCUMENT]
${stateDoc}`;
}

export async function POST(request: NextRequest) {
  try {
    if (!checkRateLimit()) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Max 30 messages per minute." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { message, resumeConversation } = body;
    if (!message?.trim() && !resumeConversation) {
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

    // Build context
    const stateContext = await buildStateContext();
    const systemPrompt = ATLAS_SYSTEM_PROMPT + stateContext;

    let currentMessages: Array<{
      role: string;
      content: unknown;
    }>;

    if (resumeConversation) {
      // Resume from paused approval — restore conversation state with tool result
      currentMessages = [
        ...(resumeConversation.conversationState as Array<{ role: string; content: unknown }>),
        { role: "user", content: resumeConversation.toolResults },
      ];
    } else {
      // Normal flow — save user message and load history
      await prisma.chatMessage.create({
        data: { role: "user", content: message },
      });

      const history = await prisma.chatMessage.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      currentMessages = history.reverse().map((m) => ({
        role: m.role,
        content: m.content,
      }));
    }

    // SSE streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function sendEvent(event: string, data: unknown) {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        }

        let finalText = resumeConversation?.textSoFar || "";
        const toolExecutions: ToolExecution[] = resumeConversation?.toolExecutionsSoFar || [];
        const MAX_ITERATIONS = 15;

        try {
          for (let i = 0; i < MAX_ITERATIONS; i++) {
            sendEvent("status", {
              message: i === 0 ? "Thinking..." : `Iteration ${i + 1}...`,
              iteration: i + 1,
            });

            const response = await fetch(
              "https://api.anthropic.com/v1/messages",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-api-key": apiKey,
                  "anthropic-version": "2023-06-01",
                },
                body: JSON.stringify({
                  model: ATLAS_MODEL,
                  max_tokens: 4096,
                  system: systemPrompt,
                  messages: currentMessages,
                  tools: ALL_TOOLS,
                }),
              }
            );

            const data = await response.json();

            if (data.error) {
              finalText += `\n\n**API Error**: ${data.error.message}`;
              sendEvent("error", { message: data.error.message });
              break;
            }

            const textBlocks = (data.content || []).filter(
              (b: ContentBlock) => b.type === "text"
            );
            const toolUseBlocks = (data.content || []).filter(
              (b: ContentBlock) => b.type === "tool_use"
            );

            // Stream text as it arrives
            if (textBlocks.length > 0) {
              const newText = textBlocks
                .map((b: ContentBlock) => b.text)
                .join("\n");
              finalText += newText;
              sendEvent("text", { content: newText });
            }

            // If no tool calls, we're done
            if (toolUseBlocks.length === 0) break;

            // Execute each tool with live progress
            const toolResults: Array<{
              type: string;
              tool_use_id: string;
              content: string;
            }> = [];

            let paused = false;
            for (const toolUse of toolUseBlocks) {
              const toolInput = toolUse.input as Record<string, unknown>;
              const toolDesc =
                (toolInput.description as string) ||
                (toolInput.reason as string) ||
                (toolInput.path as string) ||
                (toolInput.command as string) ||
                "";

              // Check if this is a server tool needing approval
              if (
                SERVER_TOOL_NAMES.includes(toolUse.name!) &&
                toolInput.requires_approval === true
              ) {
                // Send approval_required event and pause
                sendEvent("approval_required", {
                  toolCallId: toolUse.id,
                  tool: toolUse.name,
                  input: toolInput,
                  reason: toolInput.reason || "",
                  conversationState: currentMessages,
                  pendingToolUses: toolUseBlocks,
                  textSoFar: finalText,
                  toolExecutionsSoFar: toolExecutions,
                });
                sendEvent("paused", { reason: "awaiting_approval" });
                paused = true;
                break;
              }

              // Notify: tool starting
              sendEvent("tool_start", {
                tool: toolUse.name,
                description: toolDesc,
              });

              // Execute server tools or workspace tools
              let result: string;
              let success: boolean;
              if (SERVER_TOOL_NAMES.includes(toolUse.name!)) {
                const out = await executeServerTool(
                  toolUse.name!,
                  toolInput
                );
                result = out.result;
                success = out.success;
              } else {
                const out = await executeTool(
                  toolUse.name!,
                  toolInput
                );
                result = out.result;
                success = out.success;
              }

              const execution: ToolExecution = {
                tool: toolUse.name!,
                description: toolDesc,
                success,
                outputPreview: result.slice(0, 500),
                timestamp: new Date().toISOString(),
              };

              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id!,
                content: result,
              });
              toolExecutions.push(execution);

              // Notify: tool completed
              sendEvent("tool_complete", execution);
            }

            if (paused) break; // Exit the agentic loop — waiting for approval

            // Feed results back to Claude for next iteration
            currentMessages.push({ role: "assistant", content: data.content });
            currentMessages.push({ role: "user", content: toolResults });

            if (data.stop_reason === "end_turn" && toolUseBlocks.length === 0)
              break;
          }

          // Save AI response to DB
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

          // Send final done event
          sendEvent("done", {
            content: finalText,
            toolExecutions,
          });
        } catch (err) {
          console.error("Chat stream error:", err);
          sendEvent("error", {
            message:
              err instanceof Error ? err.message : "Internal error",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
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

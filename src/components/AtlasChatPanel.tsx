"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ATLAS_MODEL_DISPLAY } from "@/lib/constants";

interface ToolExecution {
  tool: string;
  description: string;
  success: boolean;
  outputPreview: string;
  timestamp: string;
}

interface Message {
  id?: number;
  role: "user" | "assistant";
  content: string;
  metadata?: { toolExecutions?: ToolExecution[] };
  createdAt?: string;
}

interface PendingApproval {
  toolCallId: string;
  tool: string;
  input: Record<string, unknown>;
  reason: string;
  conversationState: unknown[];
  pendingToolUses: unknown[];
  textSoFar: string;
  toolExecutionsSoFar: ToolExecution[];
}

const TOOL_ICONS: Record<string, string> = {
  write_file: "\u{1F4DD}",
  read_file: "\u{1F4C4}",
  execute_python: "\u{1F40D}",
  execute_shell: "\u{1F5A5}\uFE0F",
  list_directory: "\u{1F4C1}",
  create_task: "\u{1F4CB}",
  update_strategy: "\u2699\uFE0F",
  create_hypothesis: "\u{1F4A1}",
  update_state_document: "\u{1F4CA}",
  log_activity: "\u{1F4CA}",
  run_shell_command: "\u{1F5A5}\uFE0F",
  server_write_file: "\u{1F4DD}",
  server_read_file: "\u{1F4C4}",
};

function renderMarkdown(text: string): string {
  let html = text
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
      return `<pre><div class="flex justify-between items-center px-3 py-1 text-[10px] text-atlas-muted border-b border-slate-700/20"><span>${lang || "code"}</span><button onclick="navigator.clipboard.writeText(this.closest('pre').querySelector('code').textContent)" class="hover:text-atlas-text">Copy</button></div><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`;
    })
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(
      /^(\d+)\. (.+)$/gm,
      '<li><span class="text-atlas-purple-soft font-semibold">$1.</span> $2</li>'
    )
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>");

  html = html.replace(/((?:<li>.*?<\/li><br\/>?)+)/g, "<ul>$1</ul>");
  return `<p>${html}</p>`;
}

function ToolExecutionCard({ exec }: { exec: ToolExecution }) {
  const [expanded, setExpanded] = useState(false);
  const icon = TOOL_ICONS[exec.tool] || "\u{1F527}";

  return (
    <div className="rounded-md bg-[#0c0e14]/60 border border-slate-700/20 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-800/30 transition-colors"
      >
        <span className="text-sm">{icon}</span>
        <span className="text-[11px] font-medium text-atlas-text flex-1 truncate">
          {exec.tool}
        </span>
        <span className="text-[10px] text-atlas-dim truncate max-w-[200px]">
          {exec.description}
        </span>
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
            exec.success
              ? "bg-atlas-green/15 text-atlas-green"
              : "bg-atlas-red/15 text-atlas-red"
          }`}
        >
          {exec.success ? "\u2705" : "\u274C"}
        </span>
        <span className="text-[10px] text-atlas-dim">
          {expanded ? "\u25BE" : "\u25B8"}
        </span>
      </button>
      {expanded && (
        <div className="px-3 py-2 border-t border-slate-700/15 bg-[#080a10]/50">
          <pre className="text-[10px] font-mono text-slate-400 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
            {exec.outputPreview}
          </pre>
        </div>
      )}
    </div>
  );
}

function LiveToolCard({
  tool,
  description,
}: {
  tool: string;
  description: string;
}) {
  const icon = TOOL_ICONS[tool] || "\u{1F527}";
  return (
    <div className="rounded-md bg-[#0c0e14]/60 border border-atlas-purple/20 overflow-hidden animate-pulse">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className="text-sm">{icon}</span>
        <span className="text-[11px] font-medium text-atlas-purple-light flex-1 truncate">
          {tool}
        </span>
        <span className="text-[10px] text-atlas-dim truncate max-w-[200px]">
          {description}
        </span>
        <div className="flex gap-0.5">
          {[0, 1, 2].map((j) => (
            <div
              key={j}
              className="w-1 h-1 rounded-full bg-atlas-purple"
              style={{
                animation: `bounce3 1.2s ease-in-out ${j * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DeployNotification({
  status,
  message,
}: {
  status: "deploying" | "success" | "failed";
  message: string;
}) {
  const config = {
    deploying: {
      bg: "bg-blue-500/10 border-blue-500/30",
      text: "text-blue-400",
      icon: "⟳",
      pulse: true,
    },
    success: {
      bg: "bg-atlas-green/10 border-atlas-green/30",
      text: "text-atlas-green",
      icon: "✓",
      pulse: false,
    },
    failed: {
      bg: "bg-atlas-red/10 border-atlas-red/30",
      text: "text-atlas-red",
      icon: "✗",
      pulse: false,
    },
  }[status];

  return (
    <div
      className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg border ${config.bg} backdrop-blur-sm shadow-lg ${config.pulse ? "animate-pulse" : ""}`}
    >
      <div className="flex items-center gap-2">
        <span className={`text-sm ${config.text} ${status === "deploying" ? "animate-spin" : ""}`}>
          {config.icon}
        </span>
        <span className={`text-[11px] font-semibold ${config.text}`}>
          {status === "deploying" ? "Deploying..." : status === "success" ? "Deployed" : "Deploy Failed"}
        </span>
        <span className="text-[10px] text-atlas-dim max-w-[200px] truncate">
          {message}
        </span>
      </div>
    </div>
  );
}

function ApprovalCard({
  approval,
  onApprove,
  onReject,
  isExecuting,
}: {
  approval: PendingApproval;
  onApprove: () => void;
  onReject: () => void;
  isExecuting: boolean;
}) {
  const icon = TOOL_ICONS[approval.tool] || "\u{1F527}";
  const displayValue =
    (approval.input.command as string) ||
    (approval.input.path as string) ||
    "";

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 overflow-hidden">
      <div className="px-3 py-2 border-b border-amber-500/20 bg-amber-500/10">
        <div className="flex items-center gap-2">
          <span className="text-sm">{icon}</span>
          <span className="text-[11px] font-bold text-amber-400 tracking-wider">
            APPROVAL REQUIRED
          </span>
          <span className="text-[10px] text-amber-400/70 ml-auto">
            {approval.tool}
          </span>
        </div>
      </div>
      <div className="px-3 py-2 space-y-2">
        {displayValue && (
          <pre className="text-[11px] font-mono text-slate-300 bg-[#0c0e14]/60 rounded px-2 py-1.5 whitespace-pre-wrap break-all">
            {displayValue}
          </pre>
        )}
        <p className="text-[11px] text-atlas-muted">{approval.reason}</p>
        <div className="flex gap-2 pt-1">
          <button
            onClick={onApprove}
            disabled={isExecuting}
            className="px-3 py-1.5 rounded text-[11px] font-bold bg-atlas-green/20 text-atlas-green border border-atlas-green/30 hover:bg-atlas-green/30 disabled:opacity-50 transition-colors"
          >
            {isExecuting ? "Running..." : "\u2713 Approve & Run"}
          </button>
          <button
            onClick={onReject}
            disabled={isExecuting}
            className="px-3 py-1.5 rounded text-[11px] font-bold bg-atlas-red/20 text-atlas-red border border-atlas-red/30 hover:bg-atlas-red/30 disabled:opacity-50 transition-colors"
          >
            \u2717 Reject
          </button>
        </div>
      </div>
    </div>
  );
}

interface AtlasChatPanelProps {
  pendingPrompt?: string;
  onPromptConsumed?: () => void;
}

export default function AtlasChatPanel({
  pendingPrompt,
  onPromptConsumed,
}: AtlasChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusText, setStatusText] = useState("");
  const [liveTools, setLiveTools] = useState<
    { tool: string; description: string }[]
  >([]);
  const [completedTools, setCompletedTools] = useState<ToolExecution[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [pendingApproval, setPendingApproval] =
    useState<PendingApproval | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [deployStatus, setDeployStatus] = useState<{
    status: "deploying" | "success" | "failed";
    message: string;
  } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load chat history
  useEffect(() => {
    fetch("/dashboard/api/chat?limit=100")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMessages(data);
      })
      .catch(() => {});
  }, []);

  // Handle pending prompt from parent
  useEffect(() => {
    if (pendingPrompt) {
      setInput(pendingPrompt);
      onPromptConsumed?.();
    }
  }, [pendingPrompt, onPromptConsumed]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, liveTools, completedTools, pendingApproval]);

  // Auto-resize textarea
  const adjustTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, []);

  const handleSSEStream = async (res: Response) => {
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    if (!reader) {
      setError("No response body");
      setIsLoading(false);
      return;
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      let eventType = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith("data: ") && eventType) {
          try {
            const data = JSON.parse(line.slice(6));

            switch (eventType) {
              case "status":
                setStatusText(data.message);
                break;

              case "text":
                setStreamingText((prev) => prev + data.content);
                break;

              case "tool_start": {
                setStatusText(`Running ${data.tool}...`);
                setLiveTools((prev) => [
                  ...prev,
                  { tool: data.tool, description: data.description },
                ]);
                // Detect deploy-related commands
                const cmdStart = (data.description || "").toLowerCase();
                if (
                  data.tool === "run_shell_command" &&
                  (cmdStart.includes("deploy") ||
                    cmdStart.includes("build") ||
                    cmdStart.includes("restart") ||
                    cmdStart.includes("git pull") ||
                    cmdStart.includes("pm2"))
                ) {
                  setDeployStatus({
                    status: "deploying",
                    message: data.description || "",
                  });
                }
                break;
              }

              case "tool_complete": {
                setLiveTools((prev) =>
                  prev.filter(
                    (t) =>
                      !(
                        t.tool === data.tool &&
                        t.description === data.description
                      )
                  )
                );
                setCompletedTools((prev) => [...prev, data]);
                setStatusText("");
                // Update deploy notification
                const cmdComplete = (data.description || "").toLowerCase();
                if (
                  data.tool === "run_shell_command" &&
                  (cmdComplete.includes("deploy") ||
                    cmdComplete.includes("build") ||
                    cmdComplete.includes("restart") ||
                    cmdComplete.includes("git pull") ||
                    cmdComplete.includes("pm2"))
                ) {
                  setDeployStatus({
                    status: data.success ? "success" : "failed",
                    message: data.description || "",
                  });
                  setTimeout(() => setDeployStatus(null), 5000);
                }
                break;
              }

              case "approval_required":
                setPendingApproval(data);
                setStatusText("");
                setLiveTools([]);
                break;

              case "paused":
                // Stream closed, waiting for approval
                break;

              case "error":
                setError(data.message);
                break;

              case "done": {
                const assistantMsg: Message = {
                  role: "assistant",
                  content: data.content || "",
                  metadata: data.toolExecutions?.length
                    ? { toolExecutions: data.toolExecutions }
                    : undefined,
                };
                setMessages((prev) => [...prev, assistantMsg]);
                setStreamingText("");
                setLiveTools([]);
                setCompletedTools([]);
                setStatusText("");
                break;
              }
            }
          } catch {
            // Ignore JSON parse errors
          }
          eventType = "";
        }
      }
    }
  };

  const sendMessage = async (
    messageOverride?: string,
    resumeData?: {
      conversationState: unknown[];
      toolResults: unknown[];
      textSoFar: string;
      toolExecutionsSoFar: ToolExecution[];
    }
  ) => {
    const msgContent = messageOverride || input.trim();
    if (!msgContent && !resumeData) return;
    if (isLoading) return;

    setError("");

    if (!resumeData) {
      const userMsg: Message = { role: "user", content: msgContent };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
    }

    setIsLoading(true);
    setStreamingText("");
    setLiveTools([]);
    setCompletedTools([]);
    setStatusText("Connecting...");

    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const body: Record<string, unknown> = resumeData
        ? { message: null, resumeConversation: resumeData }
        : { message: msgContent };

      const res = await fetch("/dashboard/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json();
        setError(errData.error || `Error ${res.status}`);
        setIsLoading(false);
        setStatusText("");
        return;
      }

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("text/event-stream")) {
        await handleSSEStream(res);
      } else {
        const data = await res.json();
        const assistantMsg: Message = {
          role: "assistant",
          content: data.content || "",
          metadata: data.toolExecutions?.length
            ? { toolExecutions: data.toolExecutions }
            : undefined,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err) {
      setError(
        `Connection error: ${err instanceof Error ? err.message : "Unknown"}`
      );
    } finally {
      setIsLoading(false);
      setStreamingText("");
      setLiveTools([]);
      setCompletedTools([]);
      setStatusText("");
    }
  };

  const handleApproval = async (approved: boolean) => {
    if (!pendingApproval) return;
    setIsApproving(true);

    try {
      const execRes = await fetch("/dashboard/api/atlas/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: pendingApproval.tool,
          input: pendingApproval.input,
          approved,
        }),
      });

      const execData = await execRes.json();

      const toolResult = {
        type: "tool_result",
        tool_use_id: pendingApproval.toolCallId,
        content: approved
          ? execData.result || "Executed successfully"
          : "User rejected this action",
      };

      const execution: ToolExecution = {
        tool: pendingApproval.tool,
        description:
          (pendingApproval.input.command as string) ||
          (pendingApproval.input.path as string) ||
          "",
        success: approved && execData.success,
        outputPreview: (execData.result || "").slice(0, 500),
        timestamp: new Date().toISOString(),
      };

      setCompletedTools((prev) => [...prev, execution]);
      setPendingApproval(null);

      // Resume conversation with the tool result
      await sendMessage(undefined, {
        conversationState: pendingApproval.conversationState as unknown[],
        toolResults: [toolResult],
        textSoFar: pendingApproval.textSoFar,
        toolExecutionsSoFar: [
          ...pendingApproval.toolExecutionsSoFar,
          execution,
        ],
      });
    } catch (err) {
      setError(
        `Execution error: ${err instanceof Error ? err.message : "Unknown"}`
      );
    } finally {
      setIsApproving(false);
    }
  };

  const clearChat = async () => {
    if (!confirm("Clear all chat history?")) return;
    await fetch("/dashboard/api/chat", { method: "DELETE" });
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Deploy notification */}
      {deployStatus && (
        <DeployNotification
          status={deployStatus.status}
          message={deployStatus.message}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-atlas-muted tracking-widest">
            ATLAS AI
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-atlas-purple/10 text-atlas-purple-light border border-atlas-purple/20">
            {ATLAS_MODEL_DISPLAY}
          </span>
        </div>
        <button
          onClick={clearChat}
          className="text-[10px] text-atlas-dim hover:text-atlas-red transition-colors"
          title="Clear chat history"
        >
          Clear
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-10">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-atlas-purple to-atlas-blue mb-3">
              <span className="text-base font-extrabold text-white">A</span>
            </div>
            <p className="text-[11px] text-atlas-muted max-w-xs mx-auto">
              Your autonomous builder for the algorithmic forex pipeline.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2 ${
              msg.role === "user" ? "flex-row-reverse" : ""
            }`}
          >
            <div
              className={`w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center text-[10px] font-extrabold text-white ${
                msg.role === "user"
                  ? "bg-gradient-to-br from-atlas-blue to-blue-700"
                  : "bg-gradient-to-br from-atlas-purple to-purple-800"
              }`}
            >
              {msg.role === "user" ? "J" : "A"}
            </div>
            <div
              className={`max-w-[90%] rounded-lg text-[12px] leading-relaxed ${
                msg.role === "user"
                  ? "px-3 py-2 bg-atlas-blue/10 border border-atlas-blue/20"
                  : "bg-atlas-surface/60 border border-slate-700/10"
              }`}
            >
              {msg.role === "assistant" ? (
                <div>
                  <div
                    className="chat-markdown px-3 py-2"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdown(msg.content || "..."),
                    }}
                  />
                  {msg.metadata?.toolExecutions &&
                    msg.metadata.toolExecutions.length > 0 && (
                      <div className="border-t border-slate-700/15 px-2 py-1.5 space-y-1">
                        <div className="text-[9px] font-bold text-atlas-muted tracking-wider mb-1">
                          EXECUTED {msg.metadata.toolExecutions.length} TOOL
                          {msg.metadata.toolExecutions.length > 1 ? "S" : ""}
                        </div>
                        {msg.metadata.toolExecutions.map(
                          (exec: ToolExecution, j: number) => (
                            <ToolExecutionCard key={j} exec={exec} />
                          )
                        )}
                      </div>
                    )}
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              )}
            </div>
          </div>
        ))}

        {/* Live streaming state */}
        {isLoading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-atlas-purple to-purple-800 flex items-center justify-center text-[10px] font-extrabold text-white">
              A
            </div>
            <div className="max-w-[90%] rounded-lg bg-atlas-surface/60 border border-slate-700/10">
              {streamingText && (
                <div
                  className="chat-markdown px-3 py-2"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(streamingText),
                  }}
                />
              )}

              {completedTools.length > 0 && (
                <div
                  className={`${streamingText ? "border-t border-slate-700/15" : ""} px-2 py-1.5 space-y-1`}
                >
                  <div className="text-[9px] font-bold text-atlas-muted tracking-wider mb-1">
                    EXECUTED {completedTools.length} TOOL
                    {completedTools.length > 1 ? "S" : ""}
                  </div>
                  {completedTools.map((exec, j) => (
                    <ToolExecutionCard key={j} exec={exec} />
                  ))}
                </div>
              )}

              {liveTools.length > 0 && (
                <div className="px-2 py-1.5 space-y-1">
                  {liveTools.map((t, j) => (
                    <LiveToolCard
                      key={j}
                      tool={t.tool}
                      description={t.description}
                    />
                  ))}
                </div>
              )}

              {!streamingText && completedTools.length === 0 && (
                <div className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((j) => (
                        <div
                          key={j}
                          className="w-1.5 h-1.5 rounded-full bg-atlas-purple"
                          style={{
                            animation: `bounce3 1.2s ease-in-out ${j * 0.2}s infinite`,
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-atlas-muted">
                      {statusText || "Thinking..."}
                    </span>
                  </div>
                </div>
              )}

              {(streamingText || completedTools.length > 0) && statusText && (
                <div className="px-2 py-1 border-t border-slate-700/15">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {[0, 1, 2].map((j) => (
                        <div
                          key={j}
                          className="w-1 h-1 rounded-full bg-atlas-purple"
                          style={{
                            animation: `bounce3 1.2s ease-in-out ${j * 0.2}s infinite`,
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-atlas-muted">
                      {statusText}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pending approval */}
        {pendingApproval && (
          <ApprovalCard
            approval={pendingApproval}
            onApprove={() => handleApproval(true)}
            onReject={() => handleApproval(false)}
            isExecuting={isApproving}
          />
        )}

        {error && (
          <div className="p-2 rounded-md bg-atlas-red/10 border border-atlas-red/20 text-[11px] text-atlas-red">
            {error}
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-800/50 bg-[#0c0e14]/80 flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              adjustTextarea();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask Atlas AI..."
            rows={1}
            className="flex-1 px-3 py-2 rounded-md bg-atlas-surface/60 border border-slate-700/30 text-atlas-text placeholder-atlas-dim text-[12px] resize-none focus:outline-none focus:border-atlas-purple/40 focus:ring-1 focus:ring-atlas-purple/20"
          />
          <button
            onClick={() => sendMessage()}
            disabled={isLoading || !input.trim()}
            className="px-3 py-2 rounded-md bg-gradient-to-r from-atlas-purple to-indigo-600 text-white text-[11px] font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            Send
          </button>
        </div>
        <div className="text-center mt-1">
          <span className="text-[9px] text-atlas-dim">
            Enter to send &middot; Shift+Enter for new line
          </span>
        </div>
      </div>
    </div>
  );
}

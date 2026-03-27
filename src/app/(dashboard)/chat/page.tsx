"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";

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

const PROMPT_TEMPLATES = [
  {
    label: "Research a hypothesis",
    prompt:
      "Research a hypothesis in the [category] category. Analyze academic literature, market microstructure, and historical patterns. Produce a structured research brief with testable hypotheses and kill criteria.",
  },
  {
    label: "Write MQL5 EA",
    prompt:
      "Write a complete MQL5 Expert Advisor for [strategy]. Use modular architecture: Signal, Risk, Execution, Session, Regime, Logger modules. Production-ready code, not pseudocode.",
  },
  {
    label: "Review backtest results",
    prompt:
      "I've run the backtest for [strategy]. Here are the results: [paste results]. Apply the 50-point scorecard and provide a detailed analysis. Flag any overfitting concerns.",
  },
  {
    label: "Adversarial critique",
    prompt:
      'Perform an adversarial critique of [strategy]. Be ruthlessly honest about: overfitting risk, data snooping bias, regime dependency, parameter sensitivity, and any logical errors in the hypothesis.',
  },
  {
    label: "Propose next 3 tasks",
    prompt:
      "Based on the current project state, propose the next 3 highest-priority tasks. For each: what to do, why it advances the pipeline, success criteria, and whether it needs approval.",
  },
  {
    label: "Weekly health report",
    prompt:
      "Generate a comprehensive weekly health report covering: pipeline progress, hypothesis library status, strategy metrics, blockers, risks, and recommended priorities for next week.",
  },
  {
    label: "List workspace",
    prompt:
      "List what's in the workspace and tell me the current project structure.",
  },
  {
    label: "Run Python analysis",
    prompt:
      "Write and run a Python script that [describe analysis]. Show me the results.",
  },
];

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

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full text-atlas-muted">
          Loading...
        </div>
      }
    >
      <ChatContent />
    </Suspense>
  );
}

function ChatContent() {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [error, setError] = useState("");
  const [statusText, setStatusText] = useState("");
  const [liveTools, setLiveTools] = useState<
    { tool: string; description: string }[]
  >([]);
  const [completedTools, setCompletedTools] = useState<ToolExecution[]>([]);
  const [streamingText, setStreamingText] = useState("");
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

  // Handle prompt from URL
  useEffect(() => {
    const prompt = searchParams.get("prompt");
    if (prompt && messages.length === 0) {
      setInput(prompt);
    }
  }, [searchParams, messages.length]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, liveTools, completedTools]);

  // Auto-resize textarea
  const adjustTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    setError("");

    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    const msgContent = input.trim();
    setInput("");
    setIsLoading(true);
    setStreamingText("");
    setLiveTools([]);
    setCompletedTools([]);
    setStatusText("Connecting...");

    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const res = await fetch("/dashboard/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msgContent }),
      });

      if (!res.ok) {
        const errData = await res.json();
        setError(errData.error || `Error ${res.status}`);
        setIsLoading(false);
        setStatusText("");
        return;
      }

      // Check if SSE response
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("text/event-stream")) {
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

                  case "tool_start":
                    setStatusText(
                      `Running ${data.tool}...`
                    );
                    setLiveTools((prev) => [
                      ...prev,
                      { tool: data.tool, description: data.description },
                    ]);
                    break;

                  case "tool_complete":
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
                    break;

                  case "error":
                    setError(data.message);
                    break;

                  case "done": {
                    // Final message — add to messages list
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
      } else {
        // Fallback: non-SSE JSON response
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

  const clearChat = async () => {
    if (!confirm("Clear all chat history?")) return;
    await fetch("/dashboard/api/chat", { method: "DELETE" });
    setMessages([]);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-64 flex-shrink-0 border-r border-slate-800/50 bg-[#0a0c12] flex flex-col">
          <div className="p-3 border-b border-slate-800/50 flex items-center justify-between">
            <span className="text-[11px] font-bold text-atlas-muted tracking-widest">
              QUICK PROMPTS
            </span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-atlas-dim hover:text-atlas-text text-xs"
            >
              \u2715
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {PROMPT_TEMPLATES.map((t, i) => (
              <button
                key={i}
                onClick={() => setInput(t.prompt)}
                className="w-full text-left px-3 py-2 rounded-md text-[11px] text-atlas-muted hover:text-atlas-text hover:bg-slate-800/40 transition-colors"
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="p-2 border-t border-slate-800/50">
            <button
              onClick={clearChat}
              className="w-full text-left px-3 py-1.5 rounded-md text-[11px] text-atlas-dim hover:text-atlas-red transition-colors"
            >
              Clear history
            </button>
          </div>
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute left-0 top-1/2 z-10 bg-atlas-surface/80 border border-slate-700/30 rounded-r-md px-1 py-3 text-atlas-muted hover:text-atlas-text text-xs"
          >
            \u25B8
          </button>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-atlas-purple to-atlas-blue mb-4">
                <span className="text-2xl font-extrabold text-white">A</span>
              </div>
              <h2 className="text-lg font-bold text-slate-200 mb-1">
                Atlas AI
              </h2>
              <p className="text-sm text-atlas-muted max-w-md mx-auto">
                Your autonomous builder for the algorithmic forex pipeline. I
                can research, write code, run analysis, and build &mdash; not
                just talk about it.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${
                msg.role === "user" ? "flex-row-reverse" : ""
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[11px] font-extrabold text-white ${
                  msg.role === "user"
                    ? "bg-gradient-to-br from-atlas-blue to-blue-700"
                    : "bg-gradient-to-br from-atlas-purple to-purple-800"
                }`}
              >
                {msg.role === "user" ? "J" : "A"}
              </div>
              <div
                className={`max-w-[80%] rounded-xl text-[13px] leading-relaxed ${
                  msg.role === "user"
                    ? "px-4 py-3 bg-atlas-blue/10 border border-atlas-blue/20"
                    : "bg-atlas-surface/60 border border-slate-700/10"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div>
                    <div
                      className="chat-markdown px-4 py-3"
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdown(msg.content || "..."),
                      }}
                    />
                    {/* Tool executions */}
                    {msg.metadata?.toolExecutions &&
                      msg.metadata.toolExecutions.length > 0 && (
                        <div className="border-t border-slate-700/15 px-3 py-2 space-y-1">
                          <div className="text-[10px] font-bold text-atlas-muted tracking-wider mb-1">
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
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-atlas-purple to-purple-800 flex items-center justify-center text-[11px] font-extrabold text-white">
                A
              </div>
              <div className="max-w-[80%] rounded-xl bg-atlas-surface/60 border border-slate-700/10">
                {/* Streaming text */}
                {streamingText && (
                  <div
                    className="chat-markdown px-4 py-3"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdown(streamingText),
                    }}
                  />
                )}

                {/* Completed tools */}
                {completedTools.length > 0 && (
                  <div
                    className={`${streamingText ? "border-t border-slate-700/15" : ""} px-3 py-2 space-y-1`}
                  >
                    <div className="text-[10px] font-bold text-atlas-muted tracking-wider mb-1">
                      EXECUTED {completedTools.length} TOOL
                      {completedTools.length > 1 ? "S" : ""}
                    </div>
                    {completedTools.map((exec, j) => (
                      <ToolExecutionCard key={j} exec={exec} />
                    ))}
                  </div>
                )}

                {/* Live running tools */}
                {liveTools.length > 0 && (
                  <div className="px-3 py-2 space-y-1">
                    {liveTools.map((t, j) => (
                      <LiveToolCard
                        key={j}
                        tool={t.tool}
                        description={t.description}
                      />
                    ))}
                  </div>
                )}

                {/* Status indicator */}
                {!streamingText && completedTools.length === 0 && (
                  <div className="px-4 py-3">
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
                      <span className="text-[11px] text-atlas-muted">
                        {statusText || "Thinking & executing..."}
                      </span>
                    </div>
                  </div>
                )}

                {/* Status bar when tools are running */}
                {(streamingText || completedTools.length > 0) &&
                  statusText && (
                    <div className="px-3 py-1.5 border-t border-slate-700/15">
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

          {error && (
            <div className="mx-10 p-3 rounded-lg bg-atlas-red/10 border border-atlas-red/20 text-sm text-atlas-red">
              {error}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-800/50 bg-[#0c0e14]/80">
          <div className="flex gap-3 items-end max-w-4xl mx-auto">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                adjustTextarea();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Talk to Atlas AI &mdash; it can research, write code, run scripts, and build autonomously..."
              rows={1}
              className="flex-1 px-4 py-2.5 rounded-lg bg-atlas-surface/60 border border-slate-700/30 text-atlas-text placeholder-atlas-dim text-sm resize-none focus:outline-none focus:border-atlas-purple/40 focus:ring-1 focus:ring-atlas-purple/20"
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-atlas-purple to-indigo-600 text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              Send
            </button>
          </div>
          <div className="text-center mt-1.5">
            <span className="text-[10px] text-atlas-dim">
              {input.length} chars &middot; Ctrl+Enter to send
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

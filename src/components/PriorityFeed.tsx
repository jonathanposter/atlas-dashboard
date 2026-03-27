"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ATLAS_MODEL_DISPLAY } from "@/lib/constants";

interface Priority {
  id: number;
  title: string;
  description: string;
  reason: string;
  action: string | null;
  source: string;
  rank: number;
  completed: boolean;
}

export default function PriorityFeed() {
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [source, setSource] = useState<string>("loading");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Load priorities on mount
  useEffect(() => {
    fetchPriorities();
  }, []);

  const fetchPriorities = async () => {
    try {
      const res = await fetch("/dashboard/api/priorities");
      const data = await res.json();
      setPriorities(data.priorities || []);
      setSource(data.source || "static");
    } catch {
      setSource("error");
    }
  };

  const refreshStatic = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/dashboard/api/priorities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useAI: false }),
      });
      const data = await res.json();
      setPriorities(data.priorities || []);
      setSource(data.source || "static");
    } catch {
      // ignore
    }
    setIsRefreshing(false);
  };

  const generateAI = async () => {
    setIsGenerating(true);
    setSource("generating");
    try {
      const res = await fetch("/dashboard/api/priorities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useAI: true }),
      });
      const data = await res.json();
      setPriorities(data.priorities || []);
      setSource(data.source || "static");
    } catch {
      setSource("error");
    }
    setIsGenerating(false);
  };

  const completePriority = async (id: number) => {
    try {
      await fetch("/dashboard/api/priorities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setPriorities((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // ignore
    }
  };

  const sourceLabel =
    source === "ai"
      ? "AI-generated"
      : source === "static"
        ? "Auto-detected"
        : source === "stored"
          ? "Saved"
          : source === "generating"
            ? "Generating..."
            : source === "loading"
              ? "Loading..."
              : "Error";

  const sourceColor =
    source === "ai"
      ? "text-atlas-purple-light"
      : source === "generating"
        ? "text-amber-400"
        : "text-atlas-muted";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-atlas-muted tracking-widest">
            PRIORITIES
          </span>
          <span className={`text-[9px] font-medium ${sourceColor}`}>
            {sourceLabel}
          </span>
        </div>
        <button
          onClick={refreshStatic}
          disabled={isRefreshing}
          className="text-[10px] text-atlas-dim hover:text-atlas-text transition-colors disabled:opacity-40"
          title="Refresh from project state"
        >
          {isRefreshing ? "..." : "↻ Refresh"}
        </button>
      </div>

      {/* Priority list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {priorities.length === 0 && source !== "loading" && source !== "generating" && (
          <div className="text-center py-10">
            <div className="text-2xl mb-2">✓</div>
            <p className="text-[11px] text-atlas-muted">
              No outstanding priorities
            </p>
          </div>
        )}

        {(source === "loading" || source === "generating") && priorities.length === 0 && (
          <div className="text-center py-10">
            <div className="flex justify-center gap-1 mb-3">
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
            <p className="text-[11px] text-atlas-muted">
              {source === "generating"
                ? "Atlas AI is analysing your project..."
                : "Loading priorities..."}
            </p>
          </div>
        )}

        {priorities.map((p, i) => (
          <div
            key={p.id || i}
            className="group rounded-lg bg-atlas-surface/40 border border-slate-700/10 hover:border-slate-700/25 transition-colors"
          >
            <div className="px-3 py-2.5">
              {/* Rank + Title */}
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-bold text-atlas-purple-light bg-atlas-purple/10 rounded w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-atlas-text leading-snug">
                    {p.title}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {p.description}
                  </p>
                  <p className="text-[10px] text-atlas-dim mt-1 italic">
                    {p.reason}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-2 ml-7">
                {p.action && (
                  <Link
                    href={p.action}
                    className="text-[10px] font-medium text-atlas-purple-soft hover:text-atlas-purple-light transition-colors"
                  >
                    Open →
                  </Link>
                )}
                {p.id && (
                  <button
                    onClick={() => completePriority(p.id)}
                    className="text-[10px] text-atlas-dim hover:text-atlas-green transition-colors opacity-0 group-hover:opacity-100"
                  >
                    ✓ Done
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* AI suggestions button */}
      <div className="p-3 border-t border-slate-800/50 bg-[#0c0e14]/80 flex-shrink-0">
        <button
          onClick={generateAI}
          disabled={isGenerating}
          className="w-full py-2 rounded-md bg-gradient-to-r from-atlas-purple/20 to-indigo-600/20 border border-atlas-purple/20 text-[11px] font-semibold text-atlas-purple-light hover:from-atlas-purple/30 hover:to-indigo-600/30 disabled:opacity-40 transition-all"
        >
          {isGenerating ? (
            <span className="flex items-center justify-center gap-2">
              <span className="flex gap-0.5">
                {[0, 1, 2].map((j) => (
                  <span
                    key={j}
                    className="inline-block w-1 h-1 rounded-full bg-atlas-purple-light"
                    style={{
                      animation: `bounce3 1.2s ease-in-out ${j * 0.2}s infinite`,
                    }}
                  />
                ))}
              </span>
              Analysing with {ATLAS_MODEL_DISPLAY}...
            </span>
          ) : (
            `Get AI suggestions · ${ATLAS_MODEL_DISPLAY}`
          )}
        </button>
      </div>
    </div>
  );
}

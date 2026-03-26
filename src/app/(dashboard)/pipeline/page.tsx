"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface Strategy {
  id: number;
  name: string;
  slug: string;
  category: string;
  pipelineStage: number;
  status: string;
  backtestResults: Record<string, number> | null;
  createdAt: string;
}

const PIPELINE_STAGES = [
  { name: "Hypothesis", icon: "💡", color: "#a78bfa", gate: "Documented hypothesis with kill criteria" },
  { name: "Algorithm", icon: "⚙️", color: "#60a5fa", gate: "Code review passed" },
  { name: "Backtest", icon: "📊", color: "#34d399", gate: "Scorecard ≥ 40/50" },
  { name: "Walk-Forward", icon: "🔬", color: "#fbbf24", gate: "WFE > 50%, all criteria pass" },
  { name: "Paper Trade", icon: "📋", color: "#f97316", gate: "90-day metrics within 30% of backtest" },
  { name: "Live", icon: "🚀", color: "#22c55e", gate: "Ongoing monitoring" },
];

const CATEGORY_COLORS: Record<string, string> = {
  momentum: "#60a5fa",
  mean_reversion: "#a78bfa",
  volatility: "#f97316",
  carry: "#34d399",
  structural: "#fbbf24",
  sentiment: "#f87171",
  correlation: "#06b6d4",
  calendar: "#8b5cf6",
};

const STATUS_COLORS: Record<string, string> = {
  active: "#22c55e",
  paused: "#fbbf24",
  killed: "#f87171",
  retired: "#64748b",
};

export default function PipelinePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full text-atlas-muted">Loading...</div>}>
      <PipelineContent />
    </Suspense>
  );
}

function PipelineContent() {
  const searchParams = useSearchParams();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [activeStage, setActiveStage] = useState<number | null>(null);

  useEffect(() => {
    const stage = searchParams.get("stage");
    if (stage) setActiveStage(parseInt(stage));
  }, [searchParams]);

  useEffect(() => {
    fetch("/dashboard/api/strategies")
      .then((r) => r.json())
      .then((d) => setStrategies(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  return (
    <div className="p-5 max-w-7xl mx-auto">
      <h1 className="text-[11px] font-bold text-atlas-muted tracking-widest mb-4">
        STRATEGY PIPELINE
      </h1>

      {/* Stage columns */}
      <div className="grid grid-cols-6 gap-3 mb-6">
        {PIPELINE_STAGES.map((stage, i) => {
          const stageStrategies = strategies.filter((s) => s.pipelineStage === i);
          const isActive = activeStage === i || activeStage === null;
          return (
            <div key={i}>
              <button
                onClick={() => setActiveStage(activeStage === i ? null : i)}
                className={`w-full p-3 rounded-t-lg text-center transition-all ${
                  isActive ? "opacity-100" : "opacity-40"
                }`}
                style={{
                  background: `${stage.color}12`,
                  borderBottom: `2px solid ${stage.color}`,
                }}
              >
                <div className="text-xl mb-1">{stage.icon}</div>
                <div
                  className="text-[11px] font-bold"
                  style={{ color: stage.color }}
                >
                  {stage.name}
                </div>
                <div className="text-[10px] text-atlas-dim mt-0.5">
                  {stageStrategies.length} strategies
                </div>
                <div className="text-[9px] text-atlas-dim mt-1 leading-tight">
                  Gate: {stage.gate}
                </div>
              </button>

              {/* Strategy cards in this stage */}
              <div className="space-y-2 mt-2">
                {stageStrategies.map((s) => (
                  <Link
                    key={s.id}
                    href={`/strategies/${s.slug}`}
                    className="block p-2.5 rounded-lg bg-atlas-surface/40 border border-slate-700/10 hover:border-atlas-purple/30 transition-all"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold truncate">
                        {s.name}
                      </span>
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background: STATUS_COLORS[s.status] || "#64748b",
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-[9px] px-1 py-0.5 rounded font-bold"
                        style={{
                          background:
                            (CATEGORY_COLORS[s.category] || "#64748b") + "20",
                          color: CATEGORY_COLORS[s.category] || "#64748b",
                        }}
                      >
                        {s.category}
                      </span>
                      <span className="text-[9px] text-atlas-dim">
                        {s.status}
                      </span>
                    </div>
                    {s.backtestResults && (
                      <div className="mt-1.5 grid grid-cols-2 gap-1 text-[9px]">
                        {s.backtestResults.profitFactor && (
                          <div className="text-atlas-dim">
                            PF:{" "}
                            <span className="text-atlas-text">
                              {s.backtestResults.profitFactor}
                            </span>
                          </div>
                        )}
                        {s.backtestResults.sharpe && (
                          <div className="text-atlas-dim">
                            SR:{" "}
                            <span className="text-atlas-text">
                              {s.backtestResults.sharpe}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {strategies.length === 0 && (
        <div className="text-center py-16">
          <div className="text-3xl text-atlas-dim mb-2">▸▸</div>
          <p className="text-sm text-atlas-muted">
            No strategies in the pipeline yet. Start by creating hypotheses in
            the Research tab.
          </p>
        </div>
      )}
    </div>
  );
}

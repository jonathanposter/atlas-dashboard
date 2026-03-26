"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";

interface Strategy {
  id: number;
  name: string;
  slug: string;
  category: string;
  pipelineStage: number;
  hypothesis: string | null;
  killCriteria: string | null;
  scorecard: Record<string, unknown> | null;
  backtestResults: Record<string, unknown> | null;
  wfaResults: Record<string, unknown> | null;
  liveMetrics: Record<string, unknown> | null;
  status: string;
  killReason: string | null;
  createdAt: string;
  updatedAt: string;
}

const STAGE_NAMES = ["Hypothesis", "Algorithm", "Backtest", "Walk-Forward", "Paper Trade", "Live"];
const TABS = ["Overview", "Hypothesis", "Backtest", "Walk-Forward", "Paper/Live", "Log"];

export default function StrategyDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [activeTab, setActiveTab] = useState("Overview");
  const [logs, setLogs] = useState<{ event: string; type: string; createdAt: string }[]>([]);

  useEffect(() => {
    fetch(`/dashboard/api/strategies/${slug}`)
      .then((r) => r.json())
      .then((d) => setStrategy(d))
      .catch(() => {});

    fetch(`/dashboard/api/log?limit=50`)
      .then((r) => r.json())
      .then((d) => {
        const filtered = (d.logs || []).filter(
          (l: { event: string }) =>
            l.event.toLowerCase().includes(slug.replace(/-/g, " "))
        );
        setLogs(filtered);
      })
      .catch(() => {});
  }, [slug]);

  if (!strategy) {
    return (
      <div className="p-5 text-center text-atlas-muted">Loading strategy...</div>
    );
  }

  const renderJson = (data: Record<string, unknown> | null, label: string) => {
    if (!data) return <div className="text-sm text-atlas-dim">No {label} data yet</div>;
    return (
      <pre className="text-xs font-mono bg-[#0c0e14]/60 rounded-lg p-4 border border-slate-700/20 overflow-x-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  };

  return (
    <div className="p-5 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-atlas-muted mb-4">
        <Link href="/pipeline" className="hover:text-atlas-text">
          Pipeline
        </Link>
        <span>→</span>
        <span className="text-atlas-text">{strategy.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">{strategy.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-atlas-purple/15 text-atlas-purple-soft">
              {strategy.category}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-atlas-blue/15 text-atlas-blue">
              Stage: {STAGE_NAMES[strategy.pipelineStage]}
            </span>
            <span
              className="text-[10px] px-2 py-0.5 rounded font-bold"
              style={{
                background:
                  strategy.status === "active"
                    ? "#22c55e20"
                    : strategy.status === "killed"
                    ? "#f8717120"
                    : "#64748b20",
                color:
                  strategy.status === "active"
                    ? "#22c55e"
                    : strategy.status === "killed"
                    ? "#f87171"
                    : "#64748b",
              }}
            >
              {strategy.status}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-800/50 mb-4">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 ${
              activeTab === tab
                ? "text-atlas-purple-light border-atlas-purple"
                : "text-atlas-muted border-transparent hover:text-atlas-text"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[300px]">
        {activeTab === "Overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-atlas-surface/40 border border-slate-700/10">
                <h3 className="text-[11px] font-bold text-atlas-muted tracking-wider mb-2">
                  KILL CRITERIA
                </h3>
                <p className="text-sm text-atlas-text leading-relaxed">
                  {strategy.killCriteria || "Not defined"}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-atlas-surface/40 border border-slate-700/10">
                <h3 className="text-[11px] font-bold text-atlas-muted tracking-wider mb-2">
                  DETAILS
                </h3>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-atlas-muted">Created</span>
                    <span>{new Date(strategy.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-atlas-muted">Updated</span>
                    <span>{new Date(strategy.updatedAt).toLocaleDateString()}</span>
                  </div>
                  {strategy.killReason && (
                    <div className="mt-2 p-2 rounded bg-atlas-red/10 border border-atlas-red/20 text-atlas-red">
                      Kill reason: {strategy.killReason}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Hypothesis" && (
          <div className="prose prose-invert max-w-none">
            {strategy.hypothesis ? (
              <div className="text-sm leading-relaxed whitespace-pre-wrap text-slate-300">
                {strategy.hypothesis}
              </div>
            ) : (
              <div className="text-sm text-atlas-dim">
                No hypothesis document attached yet.
              </div>
            )}
          </div>
        )}

        {activeTab === "Backtest" && (
          <div className="space-y-4">
            <h3 className="text-[11px] font-bold text-atlas-muted tracking-wider">
              SCORECARD RESULTS
            </h3>
            {renderJson(strategy.scorecard, "scorecard")}
            <h3 className="text-[11px] font-bold text-atlas-muted tracking-wider mt-4">
              BACKTEST RESULTS
            </h3>
            {renderJson(strategy.backtestResults, "backtest")}
          </div>
        )}

        {activeTab === "Walk-Forward" && (
          <div>
            <h3 className="text-[11px] font-bold text-atlas-muted tracking-wider mb-2">
              WALK-FORWARD ANALYSIS
            </h3>
            {renderJson(strategy.wfaResults, "WFA")}
          </div>
        )}

        {activeTab === "Paper/Live" && (
          <div>
            <h3 className="text-[11px] font-bold text-atlas-muted tracking-wider mb-2">
              LIVE METRICS
            </h3>
            {renderJson(strategy.liveMetrics, "live metrics")}
          </div>
        )}

        {activeTab === "Log" && (
          <div className="space-y-0">
            {logs.length > 0 ? (
              logs.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 py-2 border-b border-slate-800/20"
                >
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 bg-atlas-purple flex-shrink-0" />
                  <div>
                    <div className="text-xs">{entry.event}</div>
                    <div className="text-[10px] text-atlas-dim">
                      {new Date(entry.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-atlas-dim">No activity logged for this strategy</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

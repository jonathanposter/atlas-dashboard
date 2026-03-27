"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PriorityFeed from "@/components/PriorityFeed";

interface ProjectState {
  currentPhase: number;
  stats: {
    hypothesesGenerated: number;
    hypothesesKilled: number;
    strategiesInPipeline: number;
    strategiesDeployed: number;
  };
}

interface Task {
  id: number;
  title: string;
  type: string;
  status: string;
}

interface LogEntry {
  id: number;
  event: string;
  type: string;
  createdAt: string;
}

interface Strategy {
  id: number;
  pipelineStage: number;
}

const PHASES = [
  { name: "Phase 0: Sharpen the Axe", desc: "Research & hypothesis library", color: "#6366f1", objectives: ["Research 15-20 testable hypotheses", "Select broker (ECN/STP, FCA regulated, MT5)", "Decide tax structure (spread bet vs CFD)", "Acquire 5yr tick data for major pairs", "Set up Git repository with Atlas structure"] },
  { name: "Phase 1: Infrastructure", desc: "Git, MT5, data acquisition", color: "#8b5cf6", objectives: ["Configure MT5 development environment", "Set up data pipeline", "Build backtesting framework"] },
  { name: "Phase 2: First Strategy", desc: "Hypothesis → EA → backtest scripts", color: "#3b82f6", objectives: ["Select strongest hypothesis", "Build MQL5 EA", "Run initial backtests"] },
  { name: "Phase 3: Validation", desc: "Scorecard, WFA, Monte Carlo, stress", color: "#0ea5e9", objectives: ["Apply 50-point scorecard", "Walk-forward analysis", "Monte Carlo simulation"] },
  { name: "Phase 4: Paper Trading", desc: "90-day live demo + parallel strategies", color: "#10b981", objectives: ["Deploy to paper trading", "Monitor 90-day period", "Track execution quality"] },
  { name: "Phase 5: Live", desc: "Deployment at 25% allocation", color: "#22c55e", objectives: ["Phased capital deployment", "Ongoing monitoring", "Portfolio management"] },
];

const PIPELINE_STAGES = [
  { name: "Hypothesis", icon: "💡", color: "#a78bfa" },
  { name: "Algorithm", icon: "⚙️", color: "#60a5fa" },
  { name: "Backtest", icon: "📊", color: "#34d399" },
  { name: "Walk-Forward", icon: "🔬", color: "#fbbf24" },
  { name: "Paper Trade", icon: "📋", color: "#f97316" },
  { name: "Live", icon: "🚀", color: "#22c55e" },
];

export default function MissionControlPage() {
  const [state, setState] = useState<ProjectState | null>(null);
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/dashboard/api/state").then((r) => r.json()),
      fetch("/dashboard/api/tasks?status=pending").then((r) => r.json()),
      fetch("/dashboard/api/log?limit=20").then((r) => r.json()),
      fetch("/dashboard/api/strategies").then((r) => r.json()),
    ])
      .then(([stateData, tasks, logData, strats]) => {
        setState(stateData);
        setPendingTasks(Array.isArray(tasks) ? tasks : []);
        setRecentLogs(logData.logs || []);
        setStrategies(Array.isArray(strats) ? strats : []);
      })
      .catch(console.error);
  }, []);

  const stats = state?.stats || {
    hypothesesGenerated: 0,
    hypothesesKilled: 0,
    strategiesInPipeline: 0,
    strategiesDeployed: 0,
  };
  const phase = PHASES[state?.currentPhase ?? 0];

  const stageCounts = PIPELINE_STAGES.map(
    (_, i) => strategies.filter((s) => s.pipelineStage === i).length
  );

  const advancePhase = async () => {
    if (!state || state.currentPhase >= PHASES.length - 1) return;
    if (!confirm(`Advance to ${PHASES[state.currentPhase + 1].name}?`)) return;

    const newPhase = state.currentPhase + 1;
    await fetch("/dashboard/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPhase: newPhase }),
    });
    await fetch("/dashboard/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: `Phase advanced to: ${PHASES[newPhase].name}`,
        type: "milestone",
      }),
    });
    setState({ ...state, currentPhase: newPhase });
  };

  const typeColor: Record<string, string> = {
    system: "#475569",
    milestone: "#7c3aed",
    approval: "#22c55e",
    rejection: "#f87171",
    ai: "#60a5fa",
    alert: "#f97316",
    trade: "#fbbf24",
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* LEFT COLUMN — Pipeline & Stats */}
      <div className="w-[62%] flex-shrink-0 overflow-y-auto p-5 space-y-5">
        {/* Pipeline Stages */}
        <div>
          <h2 className="text-[11px] font-bold text-atlas-muted tracking-widest mb-3">
            PIPELINE STAGES
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {PIPELINE_STAGES.map((stage, i) => (
              <Link
                href={`/pipeline?stage=${i}`}
                key={i}
                className="p-3 rounded-lg text-center transition-all hover:scale-[1.02]"
                style={{
                  background:
                    stageCounts[i] > 0
                      ? `${stage.color}12`
                      : "rgba(30,33,48,0.4)",
                  border: `1px solid ${
                    stageCounts[i] > 0
                      ? stage.color + "40"
                      : "rgba(100,116,139,0.1)"
                  }`,
                }}
              >
                <div className="text-xl mb-1">{stage.icon}</div>
                <div
                  className="text-[11px] font-semibold"
                  style={{
                    color: stageCounts[i] > 0 ? stage.color : "#64748b",
                  }}
                >
                  {stage.name}
                </div>
                <div
                  className="text-[10px] font-bold mt-1"
                  style={{
                    color: stageCounts[i] > 0 ? stage.color : "#475569",
                  }}
                >
                  {stageCounts[i] > 0 ? `${stageCounts[i]} active` : "—"}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Hypotheses Researched", value: stats.hypothesesGenerated, color: "#a78bfa" },
            { label: "Hypotheses Killed", value: stats.hypothesesKilled, color: "#f87171" },
            { label: "Strategies in Pipeline", value: stats.strategiesInPipeline, color: "#60a5fa" },
            { label: "Strategies Deployed", value: stats.strategiesDeployed, color: "#34d399" },
          ].map((stat, i) => (
            <div
              key={i}
              className="p-3 rounded-lg bg-atlas-surface/40 border border-slate-700/10"
            >
              <div
                className="text-2xl font-extrabold tracking-tight"
                style={{ color: stat.color }}
              >
                {stat.value}
              </div>
              <div className="text-[10px] text-atlas-muted mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Phase Objectives */}
        <div className="p-4 rounded-lg bg-atlas-surface/40 border border-slate-700/10">
          <h3 className="text-[11px] font-bold text-atlas-muted tracking-widest mb-3">
            CURRENT PHASE OBJECTIVES
          </h3>
          <div
            className="text-sm font-bold mb-2"
            style={{ color: phase.color }}
          >
            {phase.name}
          </div>
          <div className="space-y-1.5">
            {phase.objectives.map((obj, i) => (
              <div key={i} className="text-xs text-slate-400 flex items-start gap-2">
                <span className="text-atlas-muted">▸</span>
                {obj}
              </div>
            ))}
          </div>
          {state && state.currentPhase < PHASES.length - 1 && (
            <button
              onClick={advancePhase}
              className="mt-3 px-4 py-1.5 rounded-md text-[11px] font-bold text-white"
              style={{ background: phase.color }}
            >
              Advance Phase →
            </button>
          )}
        </div>

        {/* Quick Actions */}
        <div className="p-4 rounded-lg bg-atlas-surface/40 border border-slate-700/10">
          <h3 className="text-[11px] font-bold text-atlas-muted tracking-widest mb-3">
            QUICK ACTIONS
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Research Hypotheses", href: "/research" },
              { label: "View Pipeline", href: "/pipeline" },
              { label: "Review Tasks", href: "/tasks" },
              { label: "Browse Workspace", href: "/workspace" },
            ].map((action, i) => (
              <Link
                key={i}
                href={action.href}
                className="text-left px-3 py-2 rounded-md text-xs font-medium text-atlas-purple-soft hover:bg-atlas-purple/10 border border-transparent hover:border-atlas-purple/20 transition-all"
              >
                {action.label} →
              </Link>
            ))}
          </div>

          {pendingTasks.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-700/20">
              <Link
                href="/tasks"
                className="flex items-center justify-between text-xs"
              >
                <span className="text-atlas-amber font-semibold">
                  ⚠ {pendingTasks.length} pending approval{pendingTasks.length > 1 ? "s" : ""}
                </span>
                <span className="text-atlas-muted">View →</span>
              </Link>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-[11px] font-bold text-atlas-muted tracking-widest mb-3">
            RECENT ACTIVITY
          </h2>
          <div className="space-y-0">
            {recentLogs.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 py-2 border-b border-slate-800/30"
              >
                <div
                  className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                  style={{ background: typeColor[entry.type] || "#475569" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-atlas-text truncate">
                    {entry.event}
                  </div>
                  <div className="text-[10px] text-atlas-dim mt-0.5">
                    {new Date(entry.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
            {recentLogs.length === 0 && (
              <div className="text-xs text-atlas-dim text-center py-6">
                No activity yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN — Priority Feed */}
      <div className="flex-1 border-l border-slate-800/50 flex flex-col min-w-0">
        <PriorityFeed />
      </div>
    </div>
  );
}

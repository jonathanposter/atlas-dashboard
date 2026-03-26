"use client";

import { useState, useEffect, useCallback } from "react";

interface LogEntry {
  id: number;
  event: string;
  type: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

const TYPE_COLORS: Record<string, string> = {
  system: "#475569",
  milestone: "#7c3aed",
  approval: "#22c55e",
  rejection: "#f87171",
  ai: "#60a5fa",
  alert: "#f97316",
  trade: "#fbbf24",
};

export default function LogPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const load = useCallback(() => {
    fetch(`/dashboard/api/log?limit=${limit}&offset=${offset}`)
      .then((r) => r.json())
      .then((d) => {
        setLogs(d.logs || []);
        setTotal(d.total || 0);
      })
      .catch(() => {});
  }, [offset]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[11px] font-bold text-atlas-muted tracking-widest">
          ACTIVITY LOG
        </h1>
        <span className="text-[10px] text-atlas-dim">
          {total} total entries
        </span>
      </div>

      <div className="space-y-0">
        {logs.map((entry) => (
          <div
            key={entry.id}
            className="flex items-start gap-3 py-2.5 border-b border-slate-800/20"
          >
            <div
              className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
              style={{ background: TYPE_COLORS[entry.type] || "#475569" }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-atlas-text">{entry.event}</span>
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                  style={{
                    background: (TYPE_COLORS[entry.type] || "#475569") + "20",
                    color: TYPE_COLORS[entry.type] || "#475569",
                  }}
                >
                  {entry.type}
                </span>
              </div>
              <div className="text-[10px] text-atlas-dim mt-0.5">
                {new Date(entry.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="px-3 py-1 rounded-md text-xs text-atlas-muted hover:text-atlas-text disabled:opacity-30"
          >
            ← Newer
          </button>
          <span className="text-[10px] text-atlas-dim">
            {offset + 1}–{Math.min(offset + limit, total)} of {total}
          </span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= total}
            className="px-3 py-1 rounded-md text-xs text-atlas-muted hover:text-atlas-text disabled:opacity-30"
          >
            Older →
          </button>
        </div>
      )}

      {logs.length === 0 && (
        <div className="text-center py-16">
          <div className="text-3xl text-atlas-dim mb-2">▤</div>
          <p className="text-sm text-atlas-muted">No activity logged yet</p>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";

interface Task {
  id: number;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: number;
  proposedBy: string;
  result: string | null;
  createdAt: string;
  updatedAt: string;
}

const TYPE_COLORS: Record<string, string> = {
  research: "#a78bfa",
  build: "#60a5fa",
  test: "#34d399",
  review: "#fbbf24",
  deploy: "#f97316",
};


export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", description: "", type: "research" });
  const [showRejected, setShowRejected] = useState(false);

  const loadTasks = useCallback(() => {
    fetch("/dashboard/api/tasks")
      .then((r) => r.json())
      .then((d) => setTasks(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const updateTask = async (id: number, data: Partial<Task>) => {
    await fetch(`/dashboard/api/tasks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    loadTasks();
  };

  const createTask = async () => {
    if (!newTask.title.trim()) return;
    await fetch("/dashboard/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTask),
    });
    setNewTask({ title: "", description: "", type: "research" });
    setShowNew(false);
    loadTasks();
  };

  const filtered = filter === "all" ? tasks : tasks.filter((t) => t.type === filter);

  const pending = filtered.filter((t) => t.status === "pending");
  const inProgress = filtered.filter((t) => t.status === "approved" || t.status === "in_progress");
  const completed = filtered.filter((t) => t.status === "completed");
  const rejected = filtered.filter((t) => t.status === "rejected");

  return (
    <div className="p-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[11px] font-bold text-atlas-muted tracking-widest">
          TASK QUEUE & APPROVALS
        </h1>
        <button
          onClick={() => setShowNew(!showNew)}
          className="px-3 py-1.5 rounded-md border border-atlas-purple/30 text-atlas-purple-soft text-[11px] font-semibold hover:bg-atlas-purple/10 transition-colors"
        >
          + New Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-1 mb-4">
        {["all", "research", "build", "test", "review", "deploy"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
              filter === f
                ? "bg-atlas-purple/15 text-atlas-purple-light"
                : "text-atlas-muted hover:text-atlas-text"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* New task form */}
      {showNew && (
        <div className="p-4 rounded-lg bg-atlas-surface/40 border border-atlas-purple/20 mb-4">
          <input
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            placeholder="Task title"
            className="w-full px-3 py-2 rounded-md bg-[#0c0e14]/60 border border-slate-700/20 text-sm text-atlas-text placeholder-atlas-dim focus:outline-none focus:border-atlas-purple/40 mb-2"
          />
          <textarea
            value={newTask.description}
            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
            placeholder="Description (optional)"
            rows={3}
            className="w-full px-3 py-2 rounded-md bg-[#0c0e14]/60 border border-slate-700/20 text-sm text-atlas-text placeholder-atlas-dim focus:outline-none focus:border-atlas-purple/40 mb-2 resize-none"
          />
          <div className="flex gap-2">
            <select
              value={newTask.type}
              onChange={(e) => setNewTask({ ...newTask, type: e.target.value })}
              className="px-3 py-1.5 rounded-md bg-[#0c0e14]/60 border border-slate-700/20 text-xs text-atlas-text"
            >
              <option value="research">Research</option>
              <option value="build">Build</option>
              <option value="test">Test</option>
              <option value="review">Review</option>
              <option value="deploy">Deploy</option>
            </select>
            <button
              onClick={createTask}
              className="px-4 py-1.5 rounded-md bg-atlas-purple text-white text-[11px] font-bold"
            >
              Add Task
            </button>
          </div>
        </div>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <div className="mb-6">
          <h2 className="text-[11px] font-bold text-atlas-amber tracking-wider mb-2">
            ⚠ AWAITING APPROVAL ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map((task) => (
              <div
                key={task.id}
                className="p-3 rounded-lg bg-atlas-amber/5 border border-atlas-amber/20"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                      style={{
                        background: TYPE_COLORS[task.type] + "20",
                        color: TYPE_COLORS[task.type],
                      }}
                    >
                      {task.type.toUpperCase()}
                    </span>
                    <span className="text-sm font-medium">{task.title}</span>
                    {task.proposedBy === "atlas_ai" && (
                      <span className="text-[10px] text-atlas-purple-soft">AI proposed</span>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => updateTask(task.id, { status: "approved" })}
                      className="px-3 py-1 rounded-md bg-atlas-green text-white text-[11px] font-bold"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => updateTask(task.id, { status: "rejected" })}
                      className="px-3 py-1 rounded-md border border-atlas-red/30 text-atlas-red text-[11px] font-semibold"
                    >
                      Reject
                    </button>
                  </div>
                </div>
                {task.description && (
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    {task.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* In Progress */}
      {inProgress.length > 0 && (
        <div className="mb-6">
          <h2 className="text-[11px] font-bold text-atlas-blue tracking-wider mb-2">
            ▸ IN PROGRESS ({inProgress.length})
          </h2>
          <div className="space-y-2">
            {inProgress.map((task) => (
              <div
                key={task.id}
                className="p-3 rounded-lg bg-atlas-blue/5 border border-atlas-blue/15"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                      style={{
                        background: TYPE_COLORS[task.type] + "20",
                        color: TYPE_COLORS[task.type],
                      }}
                    >
                      {task.type.toUpperCase()}
                    </span>
                    <span className="text-sm font-medium">{task.title}</span>
                  </div>
                  <button
                    onClick={() => {
                      const result = prompt("Result/outcome (optional):");
                      updateTask(task.id, { status: "completed", result });
                    }}
                    className="px-3 py-1 rounded-md bg-atlas-blue text-white text-[11px] font-bold"
                  >
                    Mark Complete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div className="mb-6">
          <h2 className="text-[11px] font-bold text-atlas-muted tracking-wider mb-2">
            COMPLETED ({completed.length})
          </h2>
          <div className="space-y-1">
            {completed.slice(0, 20).map((task) => (
              <div
                key={task.id}
                className="p-2 rounded-md bg-atlas-surface/20 border border-slate-800/10 opacity-60"
              >
                <div className="flex items-center gap-2">
                  <span className="text-atlas-green text-xs">✓</span>
                  <span className="text-xs">{task.title}</span>
                  {task.result && (
                    <span className="text-[10px] text-atlas-dim ml-auto truncate max-w-[200px]">
                      {task.result}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rejected */}
      {rejected.length > 0 && (
        <div>
          <button
            onClick={() => setShowRejected(!showRejected)}
            className="text-[11px] font-bold text-atlas-red/60 tracking-wider mb-2 hover:text-atlas-red transition-colors"
          >
            {showRejected ? "▾" : "▸"} REJECTED ({rejected.length})
          </button>
          {showRejected && (
            <div className="space-y-1">
              {rejected.map((task) => (
                <div
                  key={task.id}
                  className="p-2 rounded-md bg-atlas-red/5 border border-atlas-red/10 opacity-50"
                >
                  <span className="text-xs text-atlas-red/80">✕ {task.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {tasks.length === 0 && (
        <div className="text-center py-16">
          <div className="text-3xl text-atlas-dim mb-2">☰</div>
          <p className="text-sm text-atlas-muted">
            No tasks yet. Ask Atlas AI to propose next actions, or add tasks manually.
          </p>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Hypothesis {
  id: number;
  title: string;
  category: string;
  thesis: string;
  economicRationale: string;
  persistenceArgument: string | null;
  dataRequirements: string | null;
  expectedCharacteristics: string | null;
  killCriteria: string;
  retailEdgeClass: string | null;
  benchmark: string | null;
  status: string;
  createdAt: string;
}

const CATEGORIES = [
  "momentum", "mean_reversion", "volatility", "carry",
  "structural", "sentiment", "correlation", "calendar",
];

const STATUS_COLORS: Record<string, string> = {
  draft: "#64748b",
  approved: "#22c55e",
  in_development: "#3b82f6",
  killed: "#f87171",
};

const EMPTY_FORM = {
  title: "", category: "momentum", thesis: "", economicRationale: "",
  persistenceArgument: "", dataRequirements: "", expectedCharacteristics: "",
  killCriteria: "", retailEdgeClass: "", benchmark: "",
};

export default function ResearchPage() {
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filter, setFilter] = useState("all");

  const load = useCallback(() => {
    fetch("/dashboard/api/hypotheses")
      .then((r) => r.json())
      .then((d) => setHypotheses(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!form.title || !form.thesis || !form.killCriteria || !form.economicRationale) return;
    await fetch("/dashboard/api/hypotheses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm(EMPTY_FORM);
    setShowForm(false);
    load();
  };

  const updateStatus = async (id: number, status: string) => {
    await fetch(`/dashboard/api/hypotheses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  };

  const filtered = filter === "all"
    ? hypotheses
    : hypotheses.filter((h) => h.status === filter);

  return (
    <div className="p-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[11px] font-bold text-atlas-muted tracking-widest">
          HYPOTHESIS LIBRARY
        </h1>
        <div className="flex gap-2">
          <Link
            href="/dashboard/chat?prompt=Generate+a+comprehensive+research+brief+for+a+new+trading+hypothesis+category.+Suggest+the+most+promising+areas."
            className="px-3 py-1.5 rounded-md border border-atlas-blue/30 text-atlas-blue text-[11px] font-semibold hover:bg-atlas-blue/10"
          >
            Generate Research Brief
          </Link>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 rounded-md border border-atlas-purple/30 text-atlas-purple-soft text-[11px] font-semibold hover:bg-atlas-purple/10"
          >
            + New Hypothesis
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-1 mb-4">
        {["all", "draft", "approved", "in_development", "killed"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-md text-[11px] font-medium ${
              filter === f
                ? "bg-atlas-purple/15 text-atlas-purple-light"
                : "text-atlas-muted hover:text-atlas-text"
            }`}
          >
            {f === "all" ? "All" : f.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </button>
        ))}
      </div>

      {/* New hypothesis form */}
      {showForm && (
        <div className="p-4 rounded-lg bg-atlas-surface/40 border border-atlas-purple/20 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Hypothesis title *"
              className="px-3 py-2 rounded-md bg-[#0c0e14]/60 border border-slate-700/20 text-sm text-atlas-text placeholder-atlas-dim focus:outline-none focus:border-atlas-purple/40"
            />
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="px-3 py-2 rounded-md bg-[#0c0e14]/60 border border-slate-700/20 text-sm text-atlas-text"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace("_", " ").replace(/\b\w/g, (ch) => ch.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={form.thesis}
            onChange={(e) => setForm({ ...form, thesis: e.target.value })}
            placeholder="One-sentence thesis *"
            rows={2}
            className="w-full px-3 py-2 rounded-md bg-[#0c0e14]/60 border border-slate-700/20 text-sm text-atlas-text placeholder-atlas-dim focus:outline-none resize-none"
          />
          <textarea
            value={form.economicRationale}
            onChange={(e) => setForm({ ...form, economicRationale: e.target.value })}
            placeholder="Economic rationale *"
            rows={3}
            className="w-full px-3 py-2 rounded-md bg-[#0c0e14]/60 border border-slate-700/20 text-sm text-atlas-text placeholder-atlas-dim focus:outline-none resize-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <textarea
              value={form.persistenceArgument}
              onChange={(e) => setForm({ ...form, persistenceArgument: e.target.value })}
              placeholder="Persistence argument"
              rows={2}
              className="px-3 py-2 rounded-md bg-[#0c0e14]/60 border border-slate-700/20 text-sm text-atlas-text placeholder-atlas-dim focus:outline-none resize-none"
            />
            <textarea
              value={form.dataRequirements}
              onChange={(e) => setForm({ ...form, dataRequirements: e.target.value })}
              placeholder="Data requirements"
              rows={2}
              className="px-3 py-2 rounded-md bg-[#0c0e14]/60 border border-slate-700/20 text-sm text-atlas-text placeholder-atlas-dim focus:outline-none resize-none"
            />
          </div>
          <textarea
            value={form.expectedCharacteristics}
            onChange={(e) => setForm({ ...form, expectedCharacteristics: e.target.value })}
            placeholder="Expected characteristics"
            rows={2}
            className="w-full px-3 py-2 rounded-md bg-[#0c0e14]/60 border border-slate-700/20 text-sm text-atlas-text placeholder-atlas-dim focus:outline-none resize-none"
          />
          <textarea
            value={form.killCriteria}
            onChange={(e) => setForm({ ...form, killCriteria: e.target.value })}
            placeholder="Kill criteria * (what would disprove this hypothesis?)"
            rows={2}
            className="w-full px-3 py-2 rounded-md bg-[#0c0e14]/60 border border-slate-700/20 text-sm text-atlas-text placeholder-atlas-dim focus:outline-none resize-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              value={form.retailEdgeClass}
              onChange={(e) => setForm({ ...form, retailEdgeClass: e.target.value })}
              placeholder="Retail edge class"
              className="px-3 py-2 rounded-md bg-[#0c0e14]/60 border border-slate-700/20 text-sm text-atlas-text placeholder-atlas-dim focus:outline-none"
            />
            <input
              value={form.benchmark}
              onChange={(e) => setForm({ ...form, benchmark: e.target.value })}
              placeholder="Benchmark"
              className="px-3 py-2 rounded-md bg-[#0c0e14]/60 border border-slate-700/20 text-sm text-atlas-text placeholder-atlas-dim focus:outline-none"
            />
          </div>
          <button
            onClick={submit}
            className="px-4 py-2 rounded-md bg-atlas-purple text-white text-xs font-bold"
          >
            Create Hypothesis
          </button>
        </div>
      )}

      {/* Hypothesis grid */}
      <div className="grid grid-cols-2 gap-3">
        {filtered.map((h) => (
          <div
            key={h.id}
            className="p-4 rounded-lg bg-atlas-surface/40 border border-slate-700/10 hover:border-atlas-purple/20 transition-all"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="text-sm font-semibold">{h.title}</h3>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-atlas-purple/15 text-atlas-purple-soft">
                    {h.category}
                  </span>
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                    style={{
                      background: (STATUS_COLORS[h.status] || "#64748b") + "20",
                      color: STATUS_COLORS[h.status] || "#64748b",
                    }}
                  >
                    {h.status}
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-atlas-dim">
                {new Date(h.createdAt).toLocaleDateString()}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-2">
              {h.thesis}
            </p>
            <div className="text-[10px] text-atlas-dim mb-3">
              Kill: {h.killCriteria}
            </div>
            <div className="flex gap-1.5">
              {h.status === "draft" && (
                <>
                  <button
                    onClick={() => updateStatus(h.id, "approved")}
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-atlas-green/15 text-atlas-green hover:bg-atlas-green/25"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => updateStatus(h.id, "killed")}
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-atlas-red/15 text-atlas-red hover:bg-atlas-red/25"
                  >
                    Kill
                  </button>
                </>
              )}
              {h.status === "approved" && (
                <button
                  onClick={() => updateStatus(h.id, "in_development")}
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-atlas-blue/15 text-atlas-blue hover:bg-atlas-blue/25"
                >
                  Start Development
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="text-3xl text-atlas-dim mb-2">◈</div>
          <p className="text-sm text-atlas-muted">
            No hypotheses yet. Create one or ask Atlas AI to generate a research brief.
          </p>
        </div>
      )}
    </div>
  );
}

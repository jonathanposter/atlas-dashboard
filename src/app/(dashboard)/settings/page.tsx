"use client";

import { useState, useEffect } from "react";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [crossValidation, setCrossValidation] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/dashboard/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setSettings(d);
        setCrossValidation(d.cross_validation_enabled === "true");
      })
      .catch(() => {});
  }, []);

  const showMsg = (msg: string) => {
    setMessage(msg);
    setError("");
    setTimeout(() => setMessage(""), 3000);
  };

  const showErr = (msg: string) => {
    setError(msg);
    setMessage("");
    setTimeout(() => setError(""), 3000);
  };

  const saveApiKey = async (key: string, value: string) => {
    if (!value.trim()) return;
    const res = await fetch("/dashboard/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    if (res.ok) {
      showMsg(`${key === "anthropic_api_key" ? "Anthropic" : "OpenAI"} API key saved`);
      setAnthropicKey("");
      setOpenaiKey("");
      // Refresh settings
      const updated = await fetch("/dashboard/api/settings").then((r) => r.json());
      setSettings(updated);
    } else {
      showErr("Failed to save API key");
    }
  };

  const toggleCrossValidation = async () => {
    const newValue = !crossValidation;
    await fetch("/dashboard/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cross_validation_enabled: newValue.toString() }),
    });
    setCrossValidation(newValue);
    showMsg(`Cross-validation ${newValue ? "enabled" : "disabled"}`);
  };

  const changePassword = async () => {
    if (!newPassword || newPassword !== confirmPassword) {
      showErr("Passwords don't match");
      return;
    }
    if (newPassword.length < 8) {
      showErr("Password must be at least 8 characters");
      return;
    }
    const res = await fetch("/dashboard/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    if (res.ok) {
      showMsg("Password updated");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      showErr("Failed to change password");
    }
  };

  const resetProject = async () => {
    if (!confirm("Reset ALL project state? This deletes all tasks, strategies, hypotheses, and chat history. This cannot be undone.")) return;
    if (!confirm("Are you absolutely sure? Type 'RESET' in the next prompt to confirm.")) return;

    // Reset state
    await fetch("/dashboard/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPhase: 0,
        stats: { hypothesesGenerated: 0, hypothesesKilled: 0, strategiesInPipeline: 0, strategiesDeployed: 0 },
      }),
    });
    await fetch("/dashboard/api/chat", { method: "DELETE" });
    await fetch("/dashboard/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "Project state reset", type: "system" }),
    });
    showMsg("Project state reset");
  };

  const exportData = async () => {
    const [state, tasks, strategies, hypotheses, logData, chat] = await Promise.all([
      fetch("/dashboard/api/state").then((r) => r.json()),
      fetch("/dashboard/api/tasks").then((r) => r.json()),
      fetch("/dashboard/api/strategies").then((r) => r.json()),
      fetch("/dashboard/api/hypotheses").then((r) => r.json()),
      fetch("/dashboard/api/log?limit=1000").then((r) => r.json()),
      fetch("/dashboard/api/chat?limit=1000").then((r) => r.json()),
    ]);

    const data = { state, tasks, strategies, hypotheses, log: logData.logs, chat, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `atlas-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-5 max-w-3xl mx-auto space-y-6">
      <h1 className="text-[11px] font-bold text-atlas-muted tracking-widest">
        SETTINGS
      </h1>

      {/* Status messages */}
      {message && (
        <div className="p-3 rounded-lg bg-atlas-green/10 border border-atlas-green/20 text-sm text-atlas-green">
          {message}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-lg bg-atlas-red/10 border border-atlas-red/20 text-sm text-atlas-red">
          {error}
        </div>
      )}

      {/* API Keys */}
      <div className="p-5 rounded-lg bg-atlas-surface/40 border border-slate-700/10">
        <h2 className="text-[11px] font-bold text-atlas-muted tracking-wider mb-3">
          API KEYS
        </h2>

        <div className="space-y-4">
          {/* Anthropic */}
          <div>
            <label className="text-xs font-medium text-atlas-text block mb-1">
              Anthropic API Key (Claude)
            </label>
            {settings.anthropic_api_key ? (
              <div className="text-xs text-atlas-muted mb-1">
                Current: {settings.anthropic_api_key}
              </div>
            ) : (
              <div className="text-xs text-atlas-amber mb-1">
                ⚠ Not configured — Atlas AI chat will not work without this
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="password"
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-..."
                className="flex-1 px-3 py-2 rounded-md bg-[#0c0e14]/60 border border-slate-700/20 text-sm text-atlas-text placeholder-atlas-dim focus:outline-none focus:border-atlas-purple/40"
              />
              <button
                onClick={() => saveApiKey("anthropic_api_key", anthropicKey)}
                className="px-4 py-2 rounded-md bg-atlas-purple text-white text-xs font-bold"
              >
                Save
              </button>
            </div>
          </div>

          {/* OpenAI */}
          <div>
            <label className="text-xs font-medium text-atlas-text block mb-1">
              OpenAI API Key (Cross-validation)
            </label>
            {settings.openai_api_key ? (
              <div className="text-xs text-atlas-muted mb-1">
                Current: {settings.openai_api_key}
              </div>
            ) : (
              <div className="text-xs text-atlas-dim mb-1">
                Optional — required only if cross-validation is enabled
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
                className="flex-1 px-3 py-2 rounded-md bg-[#0c0e14]/60 border border-slate-700/20 text-sm text-atlas-text placeholder-atlas-dim focus:outline-none focus:border-atlas-purple/40"
              />
              <button
                onClick={() => saveApiKey("openai_api_key", openaiKey)}
                className="px-4 py-2 rounded-md bg-atlas-purple text-white text-xs font-bold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cross-validation */}
      <div className="p-5 rounded-lg bg-atlas-surface/40 border border-slate-700/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold text-atlas-text">
              Cross-Model Validation
            </h2>
            <p className="text-[11px] text-atlas-muted mt-0.5">
              {crossValidation
                ? "Enabled — AI proposals are reviewed by a second model before presenting to you"
                : "Disabled — Atlas AI operates as sole analyst"}
            </p>
          </div>
          <button
            onClick={toggleCrossValidation}
            className="w-11 h-6 rounded-full relative transition-colors"
            style={{ background: crossValidation ? "#7c3aed" : "#334155" }}
          >
            <div
              className="w-4 h-4 rounded-full bg-white absolute top-1 transition-all"
              style={{ left: crossValidation ? 24 : 4 }}
            />
          </button>
        </div>
      </div>

      {/* Password */}
      <div className="p-5 rounded-lg bg-atlas-surface/40 border border-slate-700/10">
        <h2 className="text-[11px] font-bold text-atlas-muted tracking-wider mb-3">
          CHANGE PASSWORD
        </h2>
        <div className="space-y-2 max-w-sm">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            className="w-full px-3 py-2 rounded-md bg-[#0c0e14]/60 border border-slate-700/20 text-sm text-atlas-text placeholder-atlas-dim focus:outline-none focus:border-atlas-purple/40"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className="w-full px-3 py-2 rounded-md bg-[#0c0e14]/60 border border-slate-700/20 text-sm text-atlas-text placeholder-atlas-dim focus:outline-none focus:border-atlas-purple/40"
          />
          <button
            onClick={changePassword}
            className="px-4 py-2 rounded-md bg-atlas-purple text-white text-xs font-bold"
          >
            Update Password
          </button>
        </div>
      </div>

      {/* Project Management */}
      <div className="p-5 rounded-lg bg-atlas-surface/40 border border-slate-700/10">
        <h2 className="text-[11px] font-bold text-atlas-muted tracking-wider mb-3">
          PROJECT MANAGEMENT
        </h2>
        <div className="flex gap-3">
          <button
            onClick={exportData}
            className="px-4 py-2 rounded-md border border-atlas-blue/30 text-atlas-blue text-xs font-semibold hover:bg-atlas-blue/10"
          >
            Export Data (JSON)
          </button>
          <button
            onClick={resetProject}
            className="px-4 py-2 rounded-md border border-atlas-red/30 text-atlas-red text-xs font-semibold hover:bg-atlas-red/10"
          >
            Reset Project State
          </button>
        </div>
      </div>
    </div>
  );
}

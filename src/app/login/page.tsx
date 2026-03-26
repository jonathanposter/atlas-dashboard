"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/dashboard/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push("/");
      } else {
        const data = await res.json();
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-atlas-bg">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-atlas-purple to-atlas-blue mb-4">
            <span className="text-2xl font-extrabold text-white">A</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">
            ATLAS MISSION CONTROL
          </h1>
          <p className="text-xs text-atlas-muted tracking-widest mt-1">
            ALGORITHMIC FOREX PIPELINE v2.0
          </p>
        </div>

        {/* Login form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoFocus
              className="w-full px-4 py-3 rounded-lg bg-atlas-surface/60 border border-slate-700/30 text-atlas-text placeholder-atlas-dim focus:outline-none focus:border-atlas-purple/50 focus:ring-1 focus:ring-atlas-purple/30 text-sm"
            />
          </div>

          {error && (
            <div className="text-atlas-red text-sm text-center">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-atlas-purple to-indigo-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Authenticating..." : "Access Dashboard"}
          </button>
        </form>

        <p className="text-center text-xs text-atlas-dim mt-6">
          Single-operator access only
        </p>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Mission Control", icon: "◉" },
  { href: "/dashboard/chat", label: "Atlas AI", icon: "⬡" },
  { href: "/dashboard/tasks", label: "Tasks", icon: "☰" },
  { href: "/dashboard/pipeline", label: "Pipeline", icon: "▸▸" },
  { href: "/dashboard/research", label: "Research", icon: "◈" },
  { href: "/dashboard/workspace", label: "Workspace", icon: "📁" },
  { href: "/dashboard/log", label: "Activity Log", icon: "▤" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙" },
];

interface ProjectState {
  currentPhase: number;
  stats: {
    hypothesesGenerated: number;
    hypothesesKilled: number;
    strategiesInPipeline: number;
    strategiesDeployed: number;
  };
}

const PHASES = [
  { name: "Phase 0: Sharpen the Axe", color: "#6366f1" },
  { name: "Phase 1: Infrastructure", color: "#8b5cf6" },
  { name: "Phase 2: First Strategy", color: "#3b82f6" },
  { name: "Phase 3: Validation", color: "#0ea5e9" },
  { name: "Phase 4: Paper Trading", color: "#10b981" },
  { name: "Phase 5: Live", color: "#22c55e" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [state, setState] = useState<ProjectState | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetch("/dashboard/api/state")
      .then((r) => r.json())
      .then((d) => setState(d))
      .catch(() => {});

    fetch("/dashboard/api/tasks?status=pending")
      .then((r) => r.json())
      .then((d) => setPendingCount(Array.isArray(d) ? d.length : 0))
      .catch(() => {});
  }, [pathname]);

  const handleLogout = async () => {
    await fetch("/dashboard/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const phase = PHASES[state?.currentPhase ?? 0];

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-56" : "w-0 overflow-hidden"
        } transition-all duration-200 flex-shrink-0 border-r border-slate-800/50 bg-[#0a0c12] flex flex-col`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-atlas-purple to-atlas-blue flex items-center justify-center text-sm font-extrabold text-white">
              A
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-slate-100">
                ATLAS
              </div>
              <div className="text-[10px] text-atlas-muted tracking-widest">
                MISSION CONTROL
              </div>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-atlas-purple/10 text-atlas-purple-light border-r-2 border-atlas-purple"
                    : "text-atlas-muted hover:text-atlas-text hover:bg-slate-800/30"
                }`}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                <span>{item.label}</span>
                {item.label === "Tasks" && pendingCount > 0 && (
                  <span className="ml-auto text-[10px] font-bold bg-atlas-amber/20 text-atlas-amber px-1.5 py-0.5 rounded">
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="p-3 border-t border-slate-800/50">
          <button
            onClick={handleLogout}
            className="w-full text-left text-xs text-atlas-dim hover:text-atlas-red transition-colors px-2 py-1.5"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-12 flex items-center justify-between px-4 border-b border-slate-800/50 bg-[#0c0e14]/80 backdrop-blur flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-atlas-muted hover:text-atlas-text text-lg"
            >
              ☰
            </button>
            {phase && (
              <div
                className="text-[11px] font-semibold px-2.5 py-1 rounded-md"
                style={{
                  background: phase.color + "18",
                  color: phase.color,
                  border: `1px solid ${phase.color}30`,
                }}
              >
                {phase.name}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-atlas-green status-pulse" />
              <span className="text-[11px] text-atlas-muted">AI Online</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

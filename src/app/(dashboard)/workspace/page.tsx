"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface TreeEntry {
  name: string;
  type: "file" | "dir";
  path: string;
  children?: TreeEntry[];
}

interface FileData {
  path: string;
  content: string;
  size: number;
  extension: string;
  modified: string;
}

function TreeNode({
  entry,
  depth,
  onSelect,
  selected,
}: {
  entry: TreeEntry;
  depth: number;
  onSelect: (path: string) => void;
  selected: string;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isSelected = selected === entry.path;

  if (entry.type === "dir") {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-1 px-2 py-1 text-left hover:bg-slate-800/30 rounded text-[11px] transition-colors"
          style={{ paddingLeft: depth * 12 + 8 }}
        >
          <span className="text-atlas-dim text-[10px]">
            {expanded ? "▾" : "▸"}
          </span>
          <span className="text-atlas-amber/80">📁</span>
          <span className="text-atlas-text font-medium">{entry.name}</span>
        </button>
        {expanded &&
          entry.children?.map((child) => (
            <TreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              onSelect={onSelect}
              selected={selected}
            />
          ))}
      </div>
    );
  }

  const extIcon: Record<string, string> = {
    py: "🐍",
    mq5: "⚙️",
    md: "📝",
    json: "📋",
    csv: "📊",
    txt: "📄",
  };
  const ext = entry.name.split(".").pop() || "";
  const icon = extIcon[ext] || "📄";

  return (
    <button
      onClick={() => onSelect(entry.path)}
      className={`w-full flex items-center gap-1 px-2 py-1 text-left rounded text-[11px] transition-colors ${
        isSelected
          ? "bg-atlas-purple/15 text-atlas-purple-light"
          : "hover:bg-slate-800/30 text-atlas-muted"
      }`}
      style={{ paddingLeft: depth * 12 + 8 }}
    >
      <span>{icon}</span>
      <span>{entry.name}</span>
    </button>
  );
}

export default function WorkspacePage() {
  const [tree, setTree] = useState<TreeEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState("");
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadDir, setUploadDir] = useState(".");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadTree = useCallback(() => {
    fetch("/dashboard/api/workspace/tree")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setTree(d);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const selectFile = async (filePath: string) => {
    setSelectedFile(filePath);
    setLoading(true);
    try {
      const res = await fetch(
        `/dashboard/api/workspace/file?path=${encodeURIComponent(filePath)}`
      );
      if (res.ok) {
        const data = await res.json();
        setFileData(data);
      } else {
        const err = await res.json();
        setFileData({
          path: filePath,
          content: `Error: ${err.error}`,
          size: 0,
          extension: "",
          modified: "",
        });
      }
    } catch {
      setFileData({
        path: filePath,
        content: "Error loading file",
        size: 0,
        extension: "",
        modified: "",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteFile = async () => {
    if (!fileData) return;
    if (!confirm(`Delete ${fileData.path}?`)) return;

    await fetch(
      `/dashboard/api/workspace/file?path=${encodeURIComponent(fileData.path)}`,
      { method: "DELETE" }
    );
    setFileData(null);
    setSelectedFile("");
    loadTree();
  };

  const copyContent = () => {
    if (fileData?.content) {
      navigator.clipboard.writeText(fileData.content);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("directory", uploadDir);

    await fetch("/dashboard/api/workspace/upload", {
      method: "POST",
      body: formData,
    });
    loadTree();
    e.target.value = "";
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* File tree */}
      <div className="w-72 flex-shrink-0 border-r border-slate-800/50 bg-[#0a0c12] flex flex-col">
        <div className="p-3 border-b border-slate-800/50 flex items-center justify-between">
          <span className="text-[11px] font-bold text-atlas-muted tracking-widest">
            WORKSPACE
          </span>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-[10px] px-2 py-1 rounded border border-atlas-purple/30 text-atlas-purple-soft hover:bg-atlas-purple/10"
          >
            Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUpload}
            className="hidden"
          />
        </div>

        {/* Upload directory selector */}
        <div className="px-3 py-1.5 border-b border-slate-800/30">
          <input
            value={uploadDir}
            onChange={(e) => setUploadDir(e.target.value)}
            placeholder="Upload to directory..."
            className="w-full text-[10px] px-2 py-1 rounded bg-[#0c0e14]/60 border border-slate-700/20 text-atlas-text placeholder-atlas-dim focus:outline-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {tree.length > 0 ? (
            tree.map((entry) => (
              <TreeNode
                key={entry.path}
                entry={entry}
                depth={0}
                onSelect={selectFile}
                selected={selectedFile}
              />
            ))
          ) : (
            <div className="text-center py-8 text-xs text-atlas-dim">
              Workspace empty or not accessible
            </div>
          )}
        </div>

        <div className="p-2 border-t border-slate-800/50">
          <button
            onClick={loadTree}
            className="w-full text-[10px] text-atlas-dim hover:text-atlas-text py-1"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* File viewer */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {fileData ? (
          <>
            {/* File header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/50 bg-[#0c0e14]/60">
              <div>
                <div className="text-xs font-medium text-atlas-text">
                  {fileData.path}
                </div>
                <div className="text-[10px] text-atlas-dim">
                  {fileData.size > 0
                    ? `${(fileData.size / 1024).toFixed(1)}KB`
                    : ""}{" "}
                  {fileData.modified
                    ? `· Modified ${new Date(fileData.modified).toLocaleString()}`
                    : ""}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={copyContent}
                  className="text-[10px] px-2 py-1 rounded border border-slate-700/30 text-atlas-muted hover:text-atlas-text"
                >
                  Copy
                </button>
                <button
                  onClick={deleteFile}
                  className="text-[10px] px-2 py-1 rounded border border-atlas-red/30 text-atlas-red hover:bg-atlas-red/10"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* File content */}
            <div className="flex-1 overflow-auto p-4">
              {loading ? (
                <div className="text-atlas-muted text-sm">Loading...</div>
              ) : fileData.extension === "md" ? (
                <div className="prose prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap text-slate-300">
                  {fileData.content}
                </div>
              ) : (
                <pre className="text-[12px] font-mono text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {fileData.content}
                </pre>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl text-atlas-dim mb-2">📁</div>
              <p className="text-sm text-atlas-muted">
                Select a file to view its contents
              </p>
              <p className="text-xs text-atlas-dim mt-1">
                Upload MT5 backtest results, data files, or any project files
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

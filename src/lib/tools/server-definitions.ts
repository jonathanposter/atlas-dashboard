export const SERVER_TOOLS = [
  {
    name: "run_shell_command",
    description:
      "Runs a shell command on the Atlas server. Use for deployments, dependency installs, running scripts, restarting services, git operations, or any server-side action. No restrictions on commands or paths.",
    input_schema: {
      type: "object" as const,
      properties: {
        command: {
          type: "string" as const,
          description: "The shell command to execute on the server",
        },
        reason: {
          type: "string" as const,
          description:
            "Plain-English explanation of what this command does and why",
        },
        requires_approval: {
          type: "boolean" as const,
          description:
            "Set true for destructive, irreversible, or high-risk commands. Set false for read-only or low-risk operations.",
        },
      },
      required: ["command", "reason", "requires_approval"],
    },
  },
  {
    name: "server_write_file",
    description:
      "Writes or overwrites a file on the server at any absolute path. Use for creating or updating code files, config files, scripts, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string" as const,
          description:
            "Absolute path on the server where the file should be written",
        },
        content: {
          type: "string" as const,
          description: "Full file content to write",
        },
        reason: {
          type: "string" as const,
          description:
            "Plain-English explanation of what this file does and why it's being written",
        },
        requires_approval: {
          type: "boolean" as const,
          description:
            "Set true if this touches production code, config, or anything sensitive.",
        },
      },
      required: ["path", "content", "reason", "requires_approval"],
    },
  },
  {
    name: "server_read_file",
    description:
      "Reads a file from the server at any absolute path and returns its content. Always auto-approved (read-only).",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string" as const,
          description: "Absolute path of the file to read",
        },
      },
      required: ["path"],
    },
  },
];

export const ATLAS_TOOLS = [
  {
    name: "execute_python",
    description:
      "Execute a Python script on the server. Use for data analysis, statistical tests, Monte Carlo simulations, backtesting analysis, charting. Python 3.11+ with numpy, pandas, scipy, statsmodels, matplotlib, seaborn, vectorbt, scikit-learn installed. 120s timeout. Output captured and returned. NEVER use for destructive operations.",
    input_schema: {
      type: "object" as const,
      properties: {
        script: {
          type: "string" as const,
          description: "Complete self-contained Python script",
        },
        description: {
          type: "string" as const,
          description: "What this script does (logged for audit)",
        },
      },
      required: ["script", "description"],
    },
  },
  {
    name: "write_file",
    description:
      "Write content to a file in the Atlas workspace. For MQL5 EAs, Python scripts, hypothesis docs, reports, configs. Path relative to workspace root. Creates directories as needed. Overwrites existing.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string" as const,
          description:
            "Relative path e.g. 'strategies/mean-rev-asian/ea/MeanRevAsian.mq5'",
        },
        content: {
          type: "string" as const,
          description: "Full file content",
        },
        description: {
          type: "string" as const,
          description: "What this file is",
        },
      },
      required: ["path", "content", "description"],
    },
  },
  {
    name: "read_file",
    description:
      "Read a file from the Atlas workspace. For reviewing code, checking results, inspecting data.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string" as const,
          description: "Relative path from workspace root",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "list_directory",
    description: "List files and directories in the workspace.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string" as const,
          description: "Relative path, use '.' for root",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "execute_shell",
    description:
      "Run a shell command in the workspace. For pip install, git, file ops, data downloads. 60s timeout. Cannot use sudo or access paths outside workspace.",
    input_schema: {
      type: "object" as const,
      properties: {
        command: { type: "string" as const, description: "Shell command" },
        description: {
          type: "string" as const,
          description: "What this does",
        },
      },
      required: ["command", "description"],
    },
  },
  {
    name: "create_task",
    description:
      "Add a task to the Atlas task queue. Tasks requiring approval wait for the operator.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string" as const },
        description: { type: "string" as const },
        type: {
          type: "string" as const,
          enum: ["research", "build", "test", "review", "deploy"],
        },
        requires_approval: {
          type: "boolean" as const,
          description:
            "True for gate decisions, false for autonomous work",
        },
      },
      required: ["title", "description", "type", "requires_approval"],
    },
  },
  {
    name: "update_strategy",
    description: "Update a strategy record in the database.",
    input_schema: {
      type: "object" as const,
      properties: {
        slug: { type: "string" as const },
        updates: {
          type: "object" as const,
          description:
            "Fields: pipelineStage, scorecard, backtestResults, wfaResults, liveMetrics, status, killReason",
        },
      },
      required: ["slug", "updates"],
    },
  },
  {
    name: "create_hypothesis",
    description: "Create a new hypothesis using the standard template.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string" as const },
        category: {
          type: "string" as const,
          enum: [
            "momentum",
            "mean_reversion",
            "volatility",
            "carry",
            "structural",
            "sentiment",
            "correlation",
            "calendar",
          ],
        },
        thesis: { type: "string" as const },
        economicRationale: { type: "string" as const },
        persistenceArgument: { type: "string" as const },
        dataRequirements: { type: "string" as const },
        expectedCharacteristics: { type: "string" as const },
        killCriteria: { type: "string" as const },
        retailEdgeClass: { type: "string" as const },
        benchmark: { type: "string" as const },
      },
      required: [
        "title",
        "category",
        "thesis",
        "economicRationale",
        "killCriteria",
      ],
    },
  },
  {
    name: "update_state_document",
    description:
      "Update the persistent Atlas State Document (state.md). Call after completing significant work.",
    input_schema: {
      type: "object" as const,
      properties: {
        content: {
          type: "string" as const,
          description: "Full state document in markdown",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "log_activity",
    description: "Add an entry to the activity log.",
    input_schema: {
      type: "object" as const,
      properties: {
        event: { type: "string" as const },
        type: {
          type: "string" as const,
          enum: [
            "system",
            "milestone",
            "approval",
            "rejection",
            "ai",
            "alert",
            "build",
            "test",
            "research",
          ],
        },
      },
      required: ["event", "type"],
    },
  },
];

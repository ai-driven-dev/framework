import { describe, expect, it } from "vitest";
import type { DoctorFix } from "../../../src/contexts/installation/contract/doctor-issue.js";
import {
  describeDoctorFix,
  printAllToolsDrift,
  printInventory,
  printPluginIssues,
  printReportErrors,
  printScopeIssues,
  printToolDrift,
  printUserScopeTools,
} from "../../../src/presentation/presenters/doctor.presenter.js";
import { CapturingOutput } from "../../shared/testing/capturing-output.fake.js";
import {
  SECOND_SYNTHETIC_TOOL,
  SYNTHETIC_IDE_TOOL,
  SYNTHETIC_TOOL,
} from "../../shared/testing/synthetic-tool-id.builder.js";

describe("printing plugin issues", () => {
  it("prints nothing when there are no issues", () => {
    const output = new CapturingOutput(false);

    printPluginIssues(output, []);

    expect(output.lines).toEqual([]);
  });

  it("collapses every not-installed-on-machine issue for a tool into one line", () => {
    const output = new CapturingOutput(false);

    printPluginIssues(output, [
      {
        toolId: SECOND_SYNTHETIC_TOOL,
        pluginName: "aidd-context",
        issue: "not-installed-on-machine",
      },
      { toolId: SECOND_SYNTHETIC_TOOL, pluginName: "aidd-test", issue: "not-installed-on-machine" },
    ]);

    expect(output.lines).toEqual([
      "\nPlugins:",
      `  ${SECOND_SYNTHETIC_TOOL}: plugins not installed on this machine, run \`aidd sync\``,
    ]);
  });

  it("still prints one line per file for a genuinely drifted plugin", () => {
    const output = new CapturingOutput(false);

    printPluginIssues(output, [
      {
        toolId: SYNTHETIC_TOOL,
        pluginName: "my-plugin",
        issue: "missing",
        filePath: "commands/cmd.md",
      },
    ]);

    expect(output.lines).toEqual([
      "\nPlugins:",
      `  Plugin my-plugin (${SYNTHETIC_TOOL}): missing — commands/cmd.md\n    Fix: Run \`aidd sync\``,
    ]);
  });
});

describe("printing a scope's issues", () => {
  it("prints nothing when the scope was never reported on", () => {
    const output = new CapturingOutput(false);

    printScopeIssues(output, "AI", null);

    expect(output.lines).toEqual([]);
  });

  it("prints nothing when the scope reported no issue", () => {
    const output = new CapturingOutput(false);

    printScopeIssues(output, "AI", { issues: [] });

    expect(output.lines).toEqual([]);
  });

  it("heads the scope, then warns every informational issue before the rest", () => {
    const output = new CapturingOutput(false);

    printScopeIssues(output, "AI", {
      issues: [
        {
          severity: "error",
          message: `${SYNTHETIC_TOOL} is not registered`,
          fix: { code: "sync-reregister" },
        },
        {
          severity: "info",
          message: `${SYNTHETIC_TOOL} never ran`,
          fix: `The plugin does not load until ${SYNTHETIC_TOOL}'s own CLI has run and answered this.`,
        },
        {
          severity: "warning",
          message: `${SECOND_SYNTHETIC_TOOL} is ahead`,
          fix: { code: "update-cli" },
        },
      ],
    });

    expect(output.lines).toEqual([
      "\nAI:",
      `  ${SYNTHETIC_TOOL} never ran\n    Fix: The plugin does not load until ${SYNTHETIC_TOOL}'s own CLI has run and answered this.`,
      `  ${SYNTHETIC_TOOL} is not registered\n    Fix: Run \`aidd sync\` to re-register it.`,
      `  ${SECOND_SYNTHETIC_TOOL} is ahead\n    Fix: Run \`aidd update\` to bring this project's CLI to at least the version the host already follows.`,
    ]);
  });

  it("sends an error issue to the error channel and everything else to the warning one", () => {
    const output = new CapturingOutput(false);

    printScopeIssues(output, "User scope", {
      issues: [
        {
          severity: "error",
          message: `${SYNTHETIC_TOOL} is not registered`,
          fix: { code: "sync-reregister" },
        },
        {
          severity: "warning",
          message: `${SECOND_SYNTHETIC_TOOL} is ahead`,
          fix: { code: "update-cli" },
        },
      ],
    });

    expect(output.at("error")).toEqual([
      `  ${SYNTHETIC_TOOL} is not registered\n    Fix: Run \`aidd sync\` to re-register it.`,
    ]);
    expect(output.at("warn")).toEqual([
      `  ${SECOND_SYNTHETIC_TOOL} is ahead\n    Fix: Run \`aidd update\` to bring this project's CLI to at least the version the host already follows.`,
    ]);
  });
});

describe("printing the inventory of a category", () => {
  it("prints nothing when the category holds no tool", () => {
    const output = new CapturingOutput(false);

    printInventory(output, { label: "AI", doctorReport: { toolHealth: [] }, statusTools: [] });

    expect(output.lines).toEqual([]);
  });

  it("prints nothing when the category was never reported on", () => {
    const output = new CapturingOutput(false);

    printInventory(output, {
      label: "AI",
      doctorReport: null,
      statusTools: [{ toolId: SYNTHETIC_TOOL, version: "7.0.0" }],
    });

    expect(output.lines).toEqual([]);
  });

  it("heads the category, then counts each tool's files and merge files at its version", () => {
    const output = new CapturingOutput(false);

    printInventory(output, {
      label: "AI",
      doctorReport: { toolHealth: [{ toolId: SYNTHETIC_TOOL, fileCount: 12, mergeFileCount: 2 }] },
      statusTools: [
        { toolId: SECOND_SYNTHETIC_TOOL, version: "6.0.0" },
        { toolId: SYNTHETIC_TOOL, version: "7.0.0" },
      ],
    });

    expect(output.lines).toEqual([
      "\nAI tools:",
      `  ${SYNTHETIC_TOOL} (v7.0.0): 12 files, 2 merge files`,
    ]);
  });

  it("calls a version the status report never named unknown", () => {
    const output = new CapturingOutput(false);

    printInventory(output, {
      label: "IDE",
      doctorReport: {
        toolHealth: [{ toolId: SYNTHETIC_IDE_TOOL, fileCount: 1, mergeFileCount: 0 }],
      },
      statusTools: [],
    });

    expect(output.lines).toEqual([
      "\nIDE tools:",
      `  ${SYNTHETIC_IDE_TOOL} (vunknown): 1 files, 0 merge files`,
    ]);
  });
});

describe("printing the errors of a run", () => {
  it("prints nothing when the run reported no error", () => {
    const output = new CapturingOutput(false);

    printReportErrors(output, []);

    expect(output.lines).toEqual([]);
  });

  it("warns each error under the scope it came from", () => {
    const output = new CapturingOutput(false);

    printReportErrors(output, [{ scope: SYNTHETIC_TOOL, error: "settings unreadable" }]);

    expect(output.at("warn")).toEqual([`[${SYNTHETIC_TOOL}] settings unreadable`]);
  });
});

describe("printing drift for every tool", () => {
  it("heads drift, then reports AI tools, IDE tools and plugins in that order", () => {
    const output = new CapturingOutput(false);

    printAllToolsDrift(output, {
      aiTools: { tools: [{ toolId: SYNTHETIC_TOOL, version: "7.0.0", drifted: [] }] },
      ideTools: { tools: [] },
      pluginDrift: [],
    });

    expect(output.lines).toEqual([
      "\nDrift:",
      "AI tools:",
      `  ${SYNTHETIC_TOOL} (v7.0.0): in sync`,
      "IDE tools:",
      "  (none installed)",
      "Plugins:",
      "  (all in sync)",
    ]);
  });
});

describe("printing drift for one tool", () => {
  it("heads drift, then reports the one tool and its plugins, naming no category", () => {
    const output = new CapturingOutput(false);

    printToolDrift(output, {
      tools: [{ toolId: SYNTHETIC_TOOL, version: "7.0.0", drifted: [] }],
      pluginDrift: [],
    });

    expect(output.lines).toEqual([
      "\nDrift:",
      `  ${SYNTHETIC_TOOL} (v7.0.0): in sync`,
      "Plugins:",
      "  (all in sync)",
    ]);
  });
});

describe("printing the machine-wide tools", () => {
  it("heads the machine-wide tools even when none is registered", () => {
    const output = new CapturingOutput(false);

    printUserScopeTools(output, []);

    expect(output.lines).toEqual(["User-scope tools:"]);
  });

  it("names each tool, its version and the file its activation is expected in", () => {
    const output = new CapturingOutput(false);

    printUserScopeTools(output, [
      {
        toolId: SYNTHETIC_TOOL,
        version: "7.0.0",
        settings: `/home/me/.${SYNTHETIC_TOOL}/settings.json`,
      },
      {
        toolId: SECOND_SYNTHETIC_TOOL,
        version: "unknown",
        settings: "no user-scope settings file",
      },
    ]);

    expect(output.lines).toEqual([
      "User-scope tools:",
      `  ${SYNTHETIC_TOOL} (v7.0.0): expects activation in /home/me/.${SYNTHETIC_TOOL}/settings.json`,
      `  ${SECOND_SYNTHETIC_TOOL} (vunknown): expects activation in no user-scope settings file`,
    ]);
  });
});

describe("the words of what a person does about a doctor issue", () => {
  const cases: [string | DoctorFix, string][] = [
    [
      { code: "remove-or-track-directory" },
      "Remove the directory manually, or run `aidd install <tool>` to track it.",
    ],
    [
      { code: "restore-or-sync" },
      "Restore the file or run `aidd sync` to reinstall tracked files.",
    ],
    [
      { code: "sync-force", effect: "reinstall-files" },
      "Run `aidd sync --force` to reinstall tracked files.",
    ],
    [
      { code: "sync-force", effect: "revert-file" },
      "Run `aidd sync --force` to revert to the framework version.",
    ],
    [
      { code: "sync-force", effect: "restore-keys" },
      "Run `aidd sync --force` to restore managed keys.",
    ],
    [
      { code: "sync-force", effect: "restore-value" },
      "Run `aidd sync --force` to restore the original value.",
    ],
    [{ code: "sync-reregister" }, "Run `aidd sync` to re-register it."],
    [
      { code: "sync-migrate-source" },
      "Run `aidd sync` to move it to the shared, machine-scope source.",
    ],
    [
      { code: "update-cli" },
      "Run `aidd update` to bring this project's CLI to at least the version the host already follows.",
    ],
    [{ code: "authenticate" }, "Run aidd auth login"],
    [
      { code: "install-framework", tool: SYNTHETIC_TOOL },
      `Run \`aidd framework install --tool ${SYNTHETIC_TOOL}\`.`,
    ],
    [
      { code: "replace-conflicting-source", name: "m" },
      `Run \`claude plugin marketplace remove m\`, then \`aidd sync\` to re-register it for this project — or rename this project's marketplace if it is meant to point elsewhere.`,
    ],
    [
      { code: "refresh-marketplace", file: "f.json" },
      "Run `aidd marketplace refresh` to write it back to f.json.",
    ],
    [
      { code: "remove-stale-declaration", name: "m", file: "f.json" },
      "Remove the `m` entry from f.json, or run `aidd marketplace refresh` if the project registers it again.",
    ],
    [
      { code: "repair-settings-file", file: "f.json" },
      "Repair the JSON in f.json by hand, or delete it and run `aidd marketplace refresh` to write it back.",
    ],
    ["a sentence naming no command", "a sentence naming no command"],
  ];

  it.each(cases)("words %j", (fix, words) => {
    expect(describeDoctorFix(fix)).toBe(words);
  });
});

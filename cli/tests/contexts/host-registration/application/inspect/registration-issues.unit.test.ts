import { describe, expect, it } from "vitest";
import type { HostRegistrationFinding } from "../../../../../src/contexts/host-registration/application/inspect/inspect-host-registration-result.js";
import {
  registrationIssueOf,
  staleDeclarationIssue,
  undeclaredMarketplaceIssue,
  unparseableSettingsIssue,
} from "../../../../../src/contexts/host-registration/application/inspect/registration-issues.js";
import { SYNTHETIC_TOOL } from "../../../../shared/testing/synthetic-tool-id.builder.js";

const tool = SYNTHETIC_TOOL;
const found = {
  name: "aidd-framework",
  registeredSource: "/registered",
  requestedSource: "/requested",
  location: "/settings.json",
};

const gradedCases: [HostRegistrationFinding, string][] = [
  [{ kind: "registry-unanswerable", tool, detail: "d" }, "info"],
  [{ kind: "plugin-unrecorded", tool, plugin: "p" }, "info"],
  [{ kind: "plugin-missing", tool, ref: "p@m", location: "/r" }, "error"],
  [{ kind: "plugin-disabled", tool, ref: "p@m", location: "/r" }, "error"],
  [{ kind: "source-conflict", tool, ...found, pluginDiff: "x" }, "error"],
  [
    {
      kind: "source-drift",
      tool,
      found: {
        ...found,
        drift: { kind: "version-behind", registeredVersion: "2", requestedVersion: "1" },
      },
    },
    "warning",
  ],
  [
    {
      kind: "source-drift",
      tool,
      found: {
        ...found,
        drift: { kind: "unmigrated-foreign-project-source", projectRoot: "/o" },
      },
    },
    "warning",
  ],
  [
    {
      kind: "source-drift",
      tool,
      found: { ...found, drift: { kind: "unmigrated-project-source" } },
    },
    "warning",
  ],
];

describe("registration issues", () => {
  it("words an unanswered registry as an info that carries the registry's own detail", () => {
    const issue = registrationIssueOf({ kind: "registry-unanswerable", tool, detail: "no binary" });

    expect(issue).toMatchObject({ severity: "info", message: "no binary" });
  });

  it("words a plugin with no recorded marketplace as an info", () => {
    const issue = registrationIssueOf({ kind: "plugin-unrecorded", tool, plugin: "p" });

    expect(issue.severity).toBe("info");
    expect(issue.message).toContain("records no marketplace for p");
  });

  it("words a missing plugin as an error that points at sync", () => {
    const issue = registrationIssueOf({
      kind: "plugin-missing",
      tool,
      ref: "p@m",
      location: "/registry",
    });

    expect(issue).toMatchObject({ severity: "error", fix: { code: "sync-reregister" } });
  });

  it("words a disabled plugin as an error that points at the tool's install", () => {
    const issue = registrationIssueOf({
      kind: "plugin-disabled",
      tool,
      ref: "p@m",
      location: "/registry",
    });

    expect(issue.severity).toBe("error");
    expect(issue.fix).toEqual({ code: "install-framework", tool });
  });

  it("words a different-catalog conflict as an error that names both sources", () => {
    const issue = registrationIssueOf({
      kind: "source-conflict",
      tool,
      ...found,
      pluginDiff: "differ",
    });

    expect(issue.severity).toBe("error");
    expect(issue.message).toContain("/registered");
    expect(issue.message).toContain("/requested");
  });

  it("words each drift as a warning, never an error", () => {
    const drifts = [
      { kind: "version-behind", registeredVersion: "2", requestedVersion: "1" },
      { kind: "unmigrated-foreign-project-source", projectRoot: "/other" },
      { kind: "unmigrated-project-source" },
    ] as const;

    const issues = drifts.map((drift) =>
      registrationIssueOf({ kind: "source-drift", tool, found: { ...found, drift } })
    );

    expect(issues.map((issue) => issue.severity)).toEqual(["warning", "warning", "warning"]);
    expect(issues[0].message).toContain("newer aidd-framework build, 2");
    expect(issues[1].message).toContain("another project's");
    expect(issues[2].message).toContain("this project's own");
  });

  it("words a settings file that cannot be read as a warning that asks for a hand repair", () => {
    expect(unparseableSettingsIssue({ tool, file: "f.json", reason: "bad" })).toStrictEqual({
      severity: "warning",
      message: `${tool}: f.json cannot be parsed (bad)`,
      fix: { code: "repair-settings-file", file: "f.json" },
    });
  });

  it("words a marketplace the settings no longer declare as a warning that asks for a refresh", () => {
    expect(undeclaredMarketplaceIssue({ tool, name: "m", file: "f.json" })).toStrictEqual({
      severity: "warning",
      message: `${tool} no longer declares marketplace 'm'`,
      fix: { code: "refresh-marketplace", file: "f.json" },
    });
  });

  it("words a declaration the project no longer registers as a warning that asks for its removal", () => {
    expect(staleDeclarationIssue({ tool, name: "m", file: "f.json" })).toStrictEqual({
      severity: "warning",
      message: `${tool} still declares marketplace 'm', which this project no longer registers`,
      fix: { code: "remove-stale-declaration", name: "m", file: "f.json" },
    });
  });

  it.each(gradedCases.map(([finding, severity]) => ({ kind: finding.kind, finding, severity })))(
    "grades $kind as $severity",
    ({ finding, severity }) => {
      expect(registrationIssueOf(finding).severity).toBe(severity);
    }
  );
});

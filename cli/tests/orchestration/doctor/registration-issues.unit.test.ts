import { describe, expect, it } from "vitest";
import { registrationIssueOf } from "../../../src/orchestration/doctor/registration-issues.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";

const tool = TOOL.claude;
const found = {
  name: "aidd-framework",
  registeredSource: "/registered",
  requestedSource: "/requested",
  location: "/settings.json",
};

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

    expect(issue).toMatchObject({ severity: "error", fix: "Run `aidd sync` to re-register it." });
  });

  it("words a disabled plugin as an error that points at the tool's install", () => {
    const issue = registrationIssueOf({
      kind: "plugin-disabled",
      tool,
      ref: "p@m",
      location: "/registry",
    });

    expect(issue.severity).toBe("error");
    expect(issue.fix).toContain(`--tool ${tool}`);
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
});

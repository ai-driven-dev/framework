import { describe, expect, it, vi } from "vitest";
import { CheckFileReferences } from "../../../src/contexts/installation/application/doctor/check-file-references.use-case.js";
import { CheckMergeFiles } from "../../../src/contexts/installation/application/doctor/check-merge-files.use-case.js";
import { CheckPluginDrift } from "../../../src/contexts/installation/application/doctor/check-plugin-drift.use-case.js";
import { CheckProjectLayout } from "../../../src/contexts/installation/application/doctor/check-project-layout.use-case.js";
import { CheckTrackedFiles } from "../../../src/contexts/installation/application/doctor/check-tracked-files.use-case.js";
import { LoadManifest } from "../../../src/contexts/installation/application/doctor/load-manifest.use-case.js";
import { LoadManifestForDoctor } from "../../../src/contexts/installation/application/doctor/load-manifest-for-doctor.use-case.js";
import { DetectPluginDrift } from "../../../src/contexts/installation/application/shared/detect-plugin-drift.use-case.js";
import type { DoctorIssue } from "../../../src/contexts/installation/contract/doctor-issue.js";
import { RunDoctor } from "../../../src/orchestration/doctor/run-doctor.use-case.js";
import { catalogOf } from "../../shared/testing/catalog-of.builder.js";
import {
  buildInstallationDeps,
  initAndInstall,
} from "../../shared/testing/installation-deps.builder.js";
import { registeredTools, TOOL } from "../../shared/testing/registered-tools.builder.js";

const PROJECT_ROOT = "/test-project";

const issueOf =
  (severity: DoctorIssue["severity"]) =>
  (message: string): DoctorIssue => ({ severity, message, fix: { code: "sync-reregister" } });

async function reportOf(category?: "ai", severity: DoctorIssue["severity"] = "warning") {
  const issue = issueOf(severity);
  const deps = await buildInstallationDeps({ tools: registeredTools() });
  await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
  const loadManifest = new LoadManifest(deps.manifestRepo);
  const checks = {
    tracked: new CheckTrackedFiles(loadManifest, deps.fs),
    merge: new CheckMergeFiles(loadManifest, deps.fs),
    references: new CheckFileReferences(loadManifest, deps.fs),
    layout: new CheckProjectLayout(loadManifest, deps.fs, catalogOf()),
    plugin: new CheckPluginDrift(
      loadManifest,
      new DetectPluginDrift(deps.fs, catalogOf(), () => "/home/dev")
    ),
  };
  vi.spyOn(checks.tracked, "execute").mockResolvedValue([issue("tracked")]);
  vi.spyOn(checks.merge, "execute").mockResolvedValue([issue("merge")]);
  vi.spyOn(checks.references, "execute").mockResolvedValue([issue("references")]);
  vi.spyOn(checks.layout, "execute").mockResolvedValue([issue("layout")]);
  const registration = { execute: async () => [issue("registration")] };
  const authentication = { execute: async () => [issue("authentication")] };
  return await new RunDoctor(
    {
      load: new LoadManifestForDoctor(loadManifest),
      checks,
      registration,
      authentication,
    },
    catalogOf()
  ).execute({ projectRoot: PROJECT_ROOT, category });
}

async function runDoctor(category?: "ai") {
  return (await reportOf(category)).issues.map((i) => i.message);
}

describe("RunDoctor", () => {
  it("lists issues in the order of the checks: tracked, merge, references, registration, layout, authentication", async () => {
    expect(await runDoctor()).toEqual([
      "tracked",
      "merge",
      "references",
      "registration",
      "layout",
      "authentication",
    ]);
  });

  it("leaves the project layout and the authentication out when a category narrows the run", async () => {
    expect(await runDoctor("ai")).toEqual(["tracked", "merge", "references", "registration"]);
  });

  it("is healthy when every issue is only informational", async () => {
    expect((await reportOf(undefined, "info")).healthy).toBe(true);
  });

  it.each(["warning", "error"] as const)("is not healthy over %s issues", async (severity) => {
    expect((await reportOf(undefined, severity)).healthy).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import type { DoctorIssue } from "../../../src/contexts/installation/contract/doctor-issue.js";
import { RunDoctor } from "../../../src/orchestration/doctor/run-doctor.use-case.js";
import { syntheticCatalog } from "../../shared/testing/synthetic-tool-id.builder.js";

const PROJECT_ROOT = "/test-project";

const issueOf =
  (severity: DoctorIssue["severity"]) =>
  (message: string): DoctorIssue => ({ severity, message, fix: { code: "sync-reregister" } });

async function reportOf(category?: "ai", severity: DoctorIssue["severity"] = "warning") {
  const issue = issueOf(severity);
  const answering = (message: string) => ({ execute: async () => [issue(message)] });
  const inspect = {
    execute: async () => ({
      toolHealth: [],
      fileIssues: ["tracked", "merge", "references"].map(issue),
      pluginIssues: [],
    }),
  };
  return await new RunDoctor(
    {
      inspect,
      layout: answering("layout"),
      registration: answering("registration"),
      authentication: answering("authentication"),
    },
    syntheticCatalog()
  ).execute({ projectRoot: PROJECT_ROOT, category });
}

async function runDoctor(category?: "ai") {
  return (await reportOf(category)).issues.map((i) => i.message);
}

describe("running the doctor", () => {
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

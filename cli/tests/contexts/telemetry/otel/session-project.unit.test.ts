import { describe, expect, it } from "vitest";
import { readSessionProject } from "../../../../src/contexts/telemetry/infrastructure/otel/actions/metadata/session-project.js";

describe("Codex native session project", () => {
  it("uses the native association and rechecks it after reading the project", async () => {
    const calls: Array<[string, object]> = [];
    const result = await readSessionProject(async (method, params) => {
      calls.push([method, params]);
      return method === "thread/read"
        ? { thread: { id: "s", sessionId: "s", projectId: "p" } }
        : { project: { id: "p", name: "Native project" } };
    }, "s");
    expect(result).toEqual({
      available: true,
      values: { "aidd.project_id": "p", "aidd.project_name": "Native project" },
    });
    expect(calls).toEqual([
      ["thread/read", { threadId: "s", includeTurns: false }],
      ["project/read", { projectId: "p" }],
      ["thread/read", { threadId: "s", includeTurns: false }],
    ]);
  });
  it("clears only an explicitly absent association", async () => {
    expect(
      await readSessionProject(
        async () => ({ thread: { id: "s", sessionId: "s", projectId: null } }),
        "s"
      )
    ).toEqual({ available: true, values: {} });
    expect(
      await readSessionProject(
        async () => ({ thread: { id: "s", sessionId: "s", cwd: "/project" } }),
        "s"
      )
    ).toEqual({ available: false });
  });
  it.each([
    { id: "other", sessionId: "s", projectId: "p" },
    { id: "s", sessionId: "root", projectId: "p" },
    { id: "s", sessionId: "s", projectId: "" },
    { id: "s", sessionId: "s", projectId: "bad\nID" },
    { id: "s", sessionId: "s", projectId: "p".repeat(1025) },
  ])("rejects unverifiable thread identity or association %j", async (thread) => {
    expect(await readSessionProject(async () => ({ thread }), "s")).toEqual({ available: false });
  });
  it.each([
    { id: "wrong", name: "Project" },
    { id: "p", name: " " },
    { id: "p", name: "bad\nname" },
    { id: "p" },
  ])("rejects a mismatched or unnamed project %j", async (project) => {
    expect(
      await readSessionProject(
        async (method) =>
          method === "thread/read"
            ? { thread: { id: "s", sessionId: "s", projectId: "p" } }
            : { project },
        "s"
      )
    ).toEqual({ available: false });
  });
  it("does not publish an association changed during the read", async () => {
    let reads = 0;
    expect(
      await readSessionProject(
        async (method) =>
          method === "thread/read"
            ? { thread: { id: "s", sessionId: "s", projectId: ++reads === 1 ? "p" : "other" } }
            : { project: { id: "p", name: "Project" } },
        "s"
      )
    ).toEqual({ available: false });
  });
  it("keeps previous information on API failure", async () => {
    expect(
      await readSessionProject(async () => {
        throw new Error("unsupported");
      }, "s")
    ).toEqual({ available: false });
  });
});

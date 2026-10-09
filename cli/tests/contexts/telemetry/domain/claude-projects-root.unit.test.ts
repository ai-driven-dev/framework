import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { claudeProjectsRoot } from "../../../../src/contexts/telemetry/domain/claude-projects-root.js";

describe("where Claude Code keeps its transcripts", () => {
  it("is projects/ under the configured directory when there is one", () => {
    expect(claudeProjectsRoot("/cfg/claude", "/home/p")).toBe(join("/cfg/claude", "projects"));
  });

  it("is projects/ under .claude in the home directory otherwise", () => {
    expect(claudeProjectsRoot(undefined, "/home/p")).toBe(join("/home/p", ".claude", "projects"));
  });

  it("reads an empty configured directory as none", () => {
    expect(claudeProjectsRoot("", "/home/p")).toBe(join("/home/p", ".claude", "projects"));
  });
});

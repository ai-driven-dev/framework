import { describe, expect, it } from "vitest";
import { isSyncExcluded, SYNC_EXCLUDED_FILES } from "../../../src/domain/models/sync-exclusions.js";

describe("SYNC_EXCLUDED_FILES", () => {
  it("is a ReadonlySet", () => {
    expect(SYNC_EXCLUDED_FILES).toBeInstanceOf(Set);
  });

  it("includes CLAUDE.md", () => {
    expect(SYNC_EXCLUDED_FILES.has("CLAUDE.md")).toBe(true);
  });

  it("includes AGENTS.md", () => {
    expect(SYNC_EXCLUDED_FILES.has("AGENTS.md")).toBe(true);
  });

  it("includes .github/copilot-instructions.md", () => {
    expect(SYNC_EXCLUDED_FILES.has(".github/copilot-instructions.md")).toBe(true);
  });

  it("includes .mcp.json", () => {
    expect(SYNC_EXCLUDED_FILES.has(".mcp.json")).toBe(true);
  });

  it("includes opencode.json", () => {
    expect(SYNC_EXCLUDED_FILES.has("opencode.json")).toBe(true);
  });
});

describe("isSyncExcluded", () => {
  const docsDir = "aidd_docs";

  it("excludes CLAUDE.md (in set)", () => {
    expect(isSyncExcluded("CLAUDE.md", docsDir)).toBe(true);
  });

  it("excludes .vscode/settings.json (prefix)", () => {
    expect(isSyncExcluded(".vscode/settings.json", docsDir)).toBe(true);
  });

  it("excludes .vscode/mcp.json (both set and prefix)", () => {
    expect(isSyncExcluded(".vscode/mcp.json", docsDir)).toBe(true);
  });

  it("excludes files under docsDir", () => {
    expect(isSyncExcluded("aidd_docs/memory/context.md", docsDir)).toBe(true);
  });

  it("excludes .aidd/ paths", () => {
    expect(isSyncExcluded(".aidd/cache/something", docsDir)).toBe(true);
  });

  it("does not exclude regular command files", () => {
    expect(isSyncExcluded(".claude/commands/04_code/implement.md", docsDir)).toBe(false);
  });

  it("does not exclude regular rule files", () => {
    expect(isSyncExcluded(".claude/rules/01-standards/exports.md", docsDir)).toBe(false);
  });

  it("does not exclude agent files", () => {
    expect(isSyncExcluded(".claude/agents/reviewer.md", docsDir)).toBe(false);
  });

  it("respects custom docsDir", () => {
    expect(isSyncExcluded("custom_docs/readme.md", "custom_docs")).toBe(true);
    expect(isSyncExcluded("aidd_docs/readme.md", "custom_docs")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { kilo } from "../../../../../../src/contexts/tools/domain/profiles/kilo/profile.js";
import { hasToolSignals } from "../../../../../../src/contexts/tools/domain/registry.js";
import { KiloDualConfigError } from "../../../../../../src/kernel/errors.js";
import { FileHash } from "../../../../../../src/kernel/file.js";
import { flatHooksPathWithLoaderEntry } from "../../../../../../src/kernel/materialization/flat-paths.js";
import type { FileReader } from "../../../../../../src/kernel/ports/file-reader.js";
import { InMemoryFileAdapter } from "../../../../../helpers/ports/in-memory-file-adapter.js";

function makeFs(existingPaths: string[]): FileReader {
  return {
    fileExists: async (path) =>
      existingPaths.includes(path.replaceAll("\\", "/").replace(/^\/project\//, "")),
    isExecutable: async () => false,
    realpath: async (path) => path,
    readFile: async () => "",
    readFileHash: async () => new FileHash("00000000000000000000000000000000"),
    listDirectory: async () => [],
    listFilesRecursive: async () => [],
  };
}

describe("kilo", () => {
  it("turns agents into Kilo subagents without copying host-specific metadata", () => {
    expect(
      kilo.capabilities.agents.convertFrontmatter({
        name: "reviewer",
        description: "Review code",
        tools: ["Read"],
      })
    ).toEqual({ description: "Review code", mode: "subagent" });
  });

  it("preserves skill metadata", () => {
    const metadata = { name: "plan", description: "Plan work", license: "MIT" };
    expect(kilo.capabilities.skills.convertFrontmatter(metadata)).toEqual(metadata);
  });

  it("namespaces commands by phase and omits argument hints unsupported by Kilo", () => {
    expect(
      kilo.capabilities.commands.convertFrontmatter(
        { name: "greet", description: "Greet someone", "argument-hint": "<name>" },
        "01-plan/greet.md"
      )
    ).toEqual({ name: "aidd:01:greet", description: "Greet someone" });
  });

  it("retains descriptions only for opt-in rules", () => {
    expect(
      kilo.capabilities.rules.convertFrontmatter({
        alwaysApply: false,
        description: "Use for TypeScript",
        globs: "*.ts",
      })
    ).toEqual({ description: "Use for TypeScript" });
    expect(
      kilo.capabilities.rules.convertFrontmatter({ alwaysApply: true, description: "Always" })
    ).toEqual({});
    expect(kilo.capabilities.rules.convertFrontmatter({ description: "Default" })).toEqual({});
    expect(kilo.capabilities.rules.convertFrontmatter({ alwaysApply: false })).toEqual({});
  });

  it("detects installed AIDD commands in Kilo's command directory", async () => {
    const fs = new InMemoryFileAdapter({
      "/project/.kilo/commands/aidd/01/greet.md": "---\nname: aidd:01:greet\n---\nHello",
      "/project/.kilo/commands/custom.md": "---\nname: custom\n---\nCustom",
    });
    const signals = await hasToolSignals(fs, kilo, "/project");
    expect(signals.map((path) => path.replaceAll("\\", "/"))).toEqual([
      ".kilo/commands/aidd/01/greet.md",
    ]);
  });

  it("declares a flat build with Kilo's agents and skills paths", () => {
    expect(kilo.buildContracts?.flat).toBeDefined();
    expect(kilo.capabilities.agents.buildInstallPath("reviewer.kilo.md")).toBe(
      ".kilo/agents/reviewer.md"
    );
    expect(kilo.capabilities.skills.buildInstallPath("01-plan/SKILL.kilo.md")).toBe(
      ".kilo/skills/01-plan/SKILL.md"
    );
    expect(kilo.capabilities.commands.buildInstallPath("01-plan/greet.md")).toBe(
      ".kilo/commands/aidd/01/greet.md"
    );
    expect(kilo.capabilities.rules.buildInstallPath("standards.kilo.md")).toBe(
      ".kilo/rules/standards.md"
    );
  });

  it("prefers project-local JSONC and reuses an existing Kilo config", async () => {
    expect(await kilo.capabilities.mcp.resolveOutput("/project", makeFs([]))).toBe(
      ".kilo/kilo.jsonc"
    );
    expect(await kilo.capabilities.mcp.resolveOutput("/project", makeFs([".kilo/kilo.json"]))).toBe(
      ".kilo/kilo.json"
    );
    expect(await kilo.capabilities.mcp.resolveOutput("/project", makeFs(["kilo.jsonc"]))).toBe(
      "kilo.jsonc"
    );
    await expect(
      kilo.capabilities.mcp.resolveOutput("/project", makeFs(["kilo.json", "kilo.jsonc"]))
    ).rejects.toThrow(KiloDualConfigError);
    await expect(
      kilo.capabilities.mcp.resolveOutput(
        "/project",
        makeFs([".kilo/kilo.json", ".kilo/kilo.jsonc"])
      )
    ).rejects.toThrow(KiloDualConfigError);
  });

  it("delivers hook scripts under .kilo/hooks and generates a bridge under .kilo/plugin", () => {
    expect(kilo.capabilities.plugins).toMatchObject({
      mode: "flat",
      acceptsHooks: true,
      flatHooksDir: ".kilo/hooks/",
    });
    expect(kilo.capabilities.plugins.flatHooksBridge?.path("aidd-context")).toBe(
      ".kilo/plugin/aidd-context-hooks.js"
    );
    const plugins = kilo.capabilities.plugins;
    expect(
      flatHooksPathWithLoaderEntry(
        plugins.flatHooksDir ?? "",
        plugins.flatHooksLoaderEntry,
        "aidd-context",
        "hooks/kilo-plugin.js"
      )
    ).toBe(".kilo/plugin/aidd-context.js");
    expect(
      flatHooksPathWithLoaderEntry(
        plugins.flatHooksDir ?? "",
        plugins.flatHooksLoaderEntry,
        "aidd-context",
        "hooks/capture.cjs"
      )
    ).toBe(".kilo/hooks/aidd-context/capture.cjs");
  });
});

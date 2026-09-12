import { describe, expect, it } from "vitest";
import { kilo } from "../../../../../../src/contexts/tools/domain/profiles/kilo/profile.js";
import { KiloDualConfigError } from "../../../../../../src/kernel/errors.js";
import { FileHash } from "../../../../../../src/kernel/file.js";
import type { FileReader } from "../../../../../../src/kernel/ports/file-reader.js";

function makeFs(existingPaths: string[]): FileReader {
  return {
    fileExists: async (path) => existingPaths.some((candidate) => path.endsWith(candidate)),
    isExecutable: async () => false,
    realpath: async (path) => path,
    readFile: async () => "",
    readFileHash: async () => new FileHash("00000000000000000000000000000000"),
    listDirectory: async () => [],
    listFilesRecursive: async () => [],
  };
}

describe("kilo", () => {
  it("declares a flat build with Kilo's agents and skills paths", () => {
    expect(kilo.buildContracts?.flat).toBeDefined();
    expect(kilo.capabilities.agents.buildInstallPath("reviewer.kilo.md")).toBe(
      ".kilo/agents/reviewer.md"
    );
    expect(kilo.capabilities.skills.buildInstallPath("01-plan/SKILL.kilo.md")).toBe(
      ".kilo/skills/01-plan/SKILL.md"
    );
  });

  it("uses kilo.json, preferring kilo.jsonc when it is the only existing config", async () => {
    expect(await kilo.capabilities.mcp.resolveOutput("/project", makeFs([]))).toBe("kilo.json");
    expect(await kilo.capabilities.mcp.resolveOutput("/project", makeFs(["kilo.jsonc"]))).toBe(
      "kilo.jsonc"
    );
    await expect(
      kilo.capabilities.mcp.resolveOutput("/project", makeFs(["kilo.json", "kilo.jsonc"]))
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
  });
});

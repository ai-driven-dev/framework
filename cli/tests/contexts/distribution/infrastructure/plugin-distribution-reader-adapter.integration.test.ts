import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PluginDistributionReaderAdapter } from "../../../../src/contexts/distribution/infrastructure/plugin-distribution-reader-adapter.js";
import type {
  PluginComponentFile,
  PluginDistribution,
} from "../../../../src/shared/domain/plugin/plugin-distribution.js";
import {
  InvalidPluginManifestError,
  InvalidPluginNameError,
} from "../../../../src/shared/domain/shared.error.js";
import { FileAdapter } from "../../../../src/shared/infrastructure/file-adapter.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { syntheticToolId } from "../../../shared/testing/synthetic-tool-id.builder.js";
import { manifestProbes } from "../testing/manifest-probes.builder.js";

const FIXTURE_DIR = join(process.cwd(), "tests/fixtures/plugins");
const IN_MEMORY_ROOT = "/plugins/in-memory";
const IN_MEMORY_MANIFEST = ".claude-plugin/plugin.json";

const FORMAT = {
  claude: syntheticToolId("claude"),
  cursor: syntheticToolId("cursor"),
  codex: syntheticToolId("codex"),
  copilot: syntheticToolId("copilot"),
};
const MANIFEST_PROBES = manifestProbes(FORMAT);

function makeAdapter(): PluginDistributionReaderAdapter {
  return new PluginDistributionReaderAdapter(new FileAdapter(), MANIFEST_PROBES);
}

function readInMemory(
  manifestText: string,
  files: Record<string, string> = {}
): Promise<PluginDistribution> {
  const seed: Record<string, string> = {
    [`${IN_MEMORY_ROOT}/${IN_MEMORY_MANIFEST}`]: manifestText,
  };
  for (const [relativePath, content] of Object.entries(files)) {
    seed[`${IN_MEMORY_ROOT}/${relativePath}`] = content;
  }
  return new PluginDistributionReaderAdapter(new InMemoryFileAdapter(seed), MANIFEST_PROBES).read(
    IN_MEMORY_ROOT
  );
}

function byPath(a: PluginComponentFile, b: PluginComponentFile): number {
  return a.relativePath.localeCompare(b.relativePath);
}

describe("reading a plugin distribution from disk", () => {
  it("looks for a manifest only where the probes it was given say one can sit", async () => {
    const fs = new InMemoryFileAdapter({
      [`${IN_MEMORY_ROOT}/custom/plugin.json`]: JSON.stringify({ name: "p", version: "1.0.0" }),
    });

    const dist = await new PluginDistributionReaderAdapter(fs, [
      { format: FORMAT.cursor, relativePath: "custom/plugin.json" },
    ]).read(IN_MEMORY_ROOT);

    expect(dist.format).toBe(FORMAT.cursor);
    await expect(
      new PluginDistributionReaderAdapter(fs, []).read(IN_MEMORY_ROOT)
    ).rejects.toBeInstanceOf(InvalidPluginManifestError);
  });

  describe("claude-format fixture", () => {
    it("detects claude format", async () => {
      const adapter = makeAdapter();
      const dist = await adapter.read(join(FIXTURE_DIR, "claude-format/sample-plugin"));
      expect(dist.format).toBe(FORMAT.claude);
    });

    it("includes all hooks/ files including companion scripts", async () => {
      const adapter = makeAdapter();
      const dist = await adapter.read(join(FIXTURE_DIR, "claude-format/sample-plugin"));
      const paths = dist.files.map((f) => f.relativePath);
      expect(paths).toContain("hooks/hooks.json");
      expect(paths).toContain("hooks/update_memory.js");
    });

    it("parses manifest fields", async () => {
      const adapter = makeAdapter();
      const dist = await adapter.read(join(FIXTURE_DIR, "claude-format/sample-plugin"));
      expect(dist.manifest.name).toBe("sample-plugin");
      expect(dist.manifest.version).toBe("1.0.0");
    });

    it("collects component files", async () => {
      const adapter = makeAdapter();
      const dist = await adapter.read(join(FIXTURE_DIR, "claude-format/sample-plugin"));
      expect(dist.files.length).toBeGreaterThan(0);
    });

    it("categorizes skills correctly", async () => {
      const adapter = makeAdapter();
      const dist = await adapter.read(join(FIXTURE_DIR, "claude-format/sample-plugin"));
      expect(dist.components.skills.length).toBe(1);
      expect(dist.components.skills[0].relativePath).toBe("skills/hello/SKILL.md");
    });

    it("categorizes commands correctly", async () => {
      const adapter = makeAdapter();
      const dist = await adapter.read(join(FIXTURE_DIR, "claude-format/sample-plugin"));
      expect(dist.components.commands.length).toBe(1);
      expect(dist.components.commands[0].relativePath).toBe("commands/greet.md");
    });

    it("categorizes agents correctly", async () => {
      const adapter = makeAdapter();
      const dist = await adapter.read(join(FIXTURE_DIR, "claude-format/sample-plugin"));
      expect(dist.components.agents.length).toBe(1);
      expect(dist.components.agents[0].relativePath).toBe("agents/reviewer.md");
    });

    it("reads file content", async () => {
      const adapter = makeAdapter();
      const dist = await adapter.read(join(FIXTURE_DIR, "claude-format/sample-plugin"));
      const skill = dist.components.skills[0];
      expect(skill.content).toContain("Hello from sample-plugin skill.");
    });

    it("includes the plugin manifest in files for native installation", async () => {
      const adapter = makeAdapter();
      const dist = await adapter.read(join(FIXTURE_DIR, "claude-format/sample-plugin"));
      const paths = dist.files.map((f) => f.relativePath);
      expect(paths).toContain(".claude-plugin/plugin.json");
    });
  });

  describe("cursor-format fixture", () => {
    it("detects cursor format", async () => {
      const adapter = makeAdapter();
      const dist = await adapter.read(join(FIXTURE_DIR, "cursor-format/sample-plugin"));
      expect(dist.format).toBe(FORMAT.cursor);
    });
  });

  describe("codex-format fixture", () => {
    it("detects codex format", async () => {
      const adapter = makeAdapter();
      const dist = await adapter.read(join(FIXTURE_DIR, "codex-format/sample-plugin"));
      expect(dist.format).toBe(FORMAT.codex);
    });
  });

  describe("copilot-format fixture", () => {
    it("detects copilot format", async () => {
      const adapter = makeAdapter();
      const dist = await adapter.read(join(FIXTURE_DIR, "copilot-format/sample-plugin"));
      expect(dist.format).toBe(FORMAT.copilot);
    });
  });

  describe("broken-plugin fixture", () => {
    it("throws InvalidPluginNameError for invalid plugin name", async () => {
      const adapter = makeAdapter();
      await expect(adapter.read(join(FIXTURE_DIR, "broken-plugin"))).rejects.toThrow(
        InvalidPluginNameError
      );
    });
  });

  describe("a directory two tools could claim", () => {
    // the reader takes the first probe that resolves: with both manifests present, the one
    // listed first names the format.
    it("resolves to the format of the first probe that finds a manifest", async () => {
      const root = await mkdtemp(join(tmpdir(), "aidd-ambiguous-"));
      try {
        const manifest = JSON.stringify({ name: "sample-plugin", version: "1.0.0" });
        await mkdir(join(root, ".codex-plugin"), { recursive: true });
        await writeFile(join(root, ".codex-plugin/plugin.json"), manifest);
        await writeFile(join(root, "plugin.json"), manifest);

        const dist = await makeAdapter().read(root);

        expect(dist.format).toBe(FORMAT.codex);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  });

  describe("a manifest carrying a strict field", () => {
    it("is read without it: strict belongs to the catalog entry, not to the plugin", async () => {
      const dir = await mkdtemp(join(tmpdir(), "aidd-plugin-strict-"));
      try {
        await mkdir(join(dir, ".claude-plugin"), { recursive: true });
        await writeFile(
          join(dir, ".claude-plugin", "plugin.json"),
          JSON.stringify({ name: "sample", version: "1.0.0", strict: true })
        );
        const dist = await makeAdapter().read(dir);
        expect(dist.manifest.strict).toBeUndefined();
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });
  });

  describe("non-existent directory", () => {
    it("throws InvalidPluginManifestError when directory has no plugin.json", async () => {
      const adapter = makeAdapter();
      await expect(adapter.read(join(FIXTURE_DIR, "nonexistent-plugin"))).rejects.toThrow(
        InvalidPluginManifestError
      );
    });

    it("names the directory it searched", async () => {
      const reader = new PluginDistributionReaderAdapter(
        new InMemoryFileAdapter(),
        MANIFEST_PROBES
      );

      await expect(reader.read("/plugins/none")).rejects.toThrow(
        new InvalidPluginManifestError('no plugin.json found in "/plugins/none"')
      );
    });
  });

  describe("collecting a plugin's files", () => {
    const manifestText = JSON.stringify({ name: "full", version: "1.0.0" });
    const componentFiles = {
      "skills/hello/SKILL.md": "skill",
      "commands/greet.md": "command",
      "agents/reviewer.md": "agent",
      "rules/style.md": "rule",
      "hooks/hooks.json": "{}",
      ".mcp.json": "{}",
    };
    const otherFiles = {
      "README.md": "readme",
      LICENSE: "license",
      "docs/guide.md": "guide",
    };

    it("keeps every component file with its content, plus the manifest, and nothing else", async () => {
      const dist = await readInMemory(manifestText, { ...componentFiles, ...otherFiles });

      expect([...dist.files].sort(byPath)).toStrictEqual([
        { relativePath: IN_MEMORY_MANIFEST, content: manifestText },
        { relativePath: ".mcp.json", content: "{}" },
        { relativePath: "agents/reviewer.md", content: "agent" },
        { relativePath: "commands/greet.md", content: "command" },
        { relativePath: "hooks/hooks.json", content: "{}" },
        { relativePath: "rules/style.md", content: "rule" },
        { relativePath: "skills/hello/SKILL.md", content: "skill" },
      ]);
    });

    it("sorts each file under its own component kind, the manifest under none", async () => {
      const dist = await readInMemory(manifestText, componentFiles);

      expect(dist.components).toStrictEqual({
        skills: [{ relativePath: "skills/hello/SKILL.md", content: "skill" }],
        commands: [{ relativePath: "commands/greet.md", content: "command" }],
        agents: [{ relativePath: "agents/reviewer.md", content: "agent" }],
        rules: [{ relativePath: "rules/style.md", content: "rule" }],
        hooks: [{ relativePath: "hooks/hooks.json", content: "{}" }],
        mcp: [{ relativePath: ".mcp.json", content: "{}" }],
      });
    });
  });
});

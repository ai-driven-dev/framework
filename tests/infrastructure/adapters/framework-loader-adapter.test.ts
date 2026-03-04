import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FrameworkLoaderAdapter } from "../../../src/infrastructure/adapters/framework-loader-adapter.js";

async function createFramework(
  baseDir: string,
  options: {
    version: string;
    sections: Record<string, { directory: string; files: Record<string, string> }>;
  }
): Promise<void> {
  const content: Record<string, { directory: string; entryFile: null }> = {};
  for (const [name, section] of Object.entries(options.sections)) {
    content[name] = { directory: section.directory, entryFile: null };
    const sectionDir = join(baseDir, section.directory);
    await mkdir(sectionDir, { recursive: true });
    for (const [filename, fileContent] of Object.entries(section.files)) {
      await writeFile(join(sectionDir, filename), fileContent, "utf-8");
    }
  }
  await writeFile(
    join(baseDir, "framework.json"),
    JSON.stringify({ version: options.version, content, templates: {}, config: {} }),
    "utf-8"
  );
}

describe("FrameworkLoaderAdapter", () => {
  const loader = new FrameworkLoaderAdapter();
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `loader-adapter-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("loading a valid framework", () => {
    it("parses framework.json and returns descriptor with correct version", async () => {
      await createFramework(tempDir, {
        version: "2.1.0",
        sections: {
          agents: { directory: "agents", files: { "my-agent.md": "# Agent" } },
        },
      });

      const { descriptor } = await loader.loadFromDirectory(tempDir);
      expect(descriptor.version).toBe("2.1.0");
    });

    it("loads content files from declared sections", async () => {
      await createFramework(tempDir, {
        version: "1.0.0",
        sections: {
          agents: {
            directory: "agents",
            files: { "agent-a.md": "content A", "agent-b.md": "content B" },
          },
        },
      });

      const { contentFiles } = await loader.loadFromDirectory(tempDir);
      expect(contentFiles.has(join("agents", "agent-a.md"))).toBe(true);
      expect(contentFiles.has(join("agents", "agent-b.md"))).toBe(true);
      expect(contentFiles.get(join("agents", "agent-a.md"))).toBe("content A");
    });

    it("loads files from multiple sections", async () => {
      await createFramework(tempDir, {
        version: "1.0.0",
        sections: {
          agents: { directory: "agents", files: { "agent.md": "agent content" } },
          rules: { directory: "rules", files: { "rule.md": "rule content" } },
        },
      });

      const { contentFiles } = await loader.loadFromDirectory(tempDir);
      expect(contentFiles.has(join("agents", "agent.md"))).toBe(true);
      expect(contentFiles.has(join("rules", "rule.md"))).toBe(true);
    });

    it("content file keys are relative paths (no leading slash)", async () => {
      await createFramework(tempDir, {
        version: "1.0.0",
        sections: {
          agents: { directory: "agents", files: { "agent.md": "" } },
        },
      });

      const { contentFiles } = await loader.loadFromDirectory(tempDir);
      for (const key of contentFiles.keys()) {
        expect(key).not.toMatch(/^\//);
      }
    });

    it("loads nested files recursively", async () => {
      const subDir = join(tempDir, "commands", "sub");
      await mkdir(subDir, { recursive: true });
      await writeFile(join(subDir, "nested.md"), "nested content", "utf-8");
      await writeFile(
        join(tempDir, "framework.json"),
        JSON.stringify({
          version: "1.0.0",
          content: { commands: { directory: "commands", entryFile: null } },
          templates: {},
          config: {},
        }),
        "utf-8"
      );

      const { contentFiles } = await loader.loadFromDirectory(tempDir);
      expect(contentFiles.has(join("commands", "sub", "nested.md"))).toBe(true);
    });

    it("returns empty contentFiles when section directory does not exist", async () => {
      await writeFile(
        join(tempDir, "framework.json"),
        JSON.stringify({
          version: "1.0.0",
          content: { missing: { directory: "nonexistent", entryFile: null } },
          templates: {},
          config: {},
        }),
        "utf-8"
      );

      const { contentFiles } = await loader.loadFromDirectory(tempDir);
      expect(contentFiles.size).toBe(0);
    });
  });

  describe("error handling", () => {
    it("throws when framework.json is missing", async () => {
      await expect(loader.loadFromDirectory(tempDir)).rejects.toThrow(
        "Failed to read framework.json"
      );
    });

    it("throws when framework.json contains invalid JSON", async () => {
      await writeFile(join(tempDir, "framework.json"), "not valid json", "utf-8");
      await expect(loader.loadFromDirectory(tempDir)).rejects.toThrow(
        "Failed to read framework.json"
      );
    });

    it("throws when framework.json is missing required version field", async () => {
      await writeFile(
        join(tempDir, "framework.json"),
        JSON.stringify({ content: { x: { directory: "x", entryFile: null } } }),
        "utf-8"
      );
      await expect(loader.loadFromDirectory(tempDir)).rejects.toThrow("missing or empty 'version'");
    });
  });
});

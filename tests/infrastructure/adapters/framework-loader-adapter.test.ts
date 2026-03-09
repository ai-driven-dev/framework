import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FrameworkLoaderAdapter } from "../../../src/infrastructure/adapters/framework-loader-adapter.js";

async function createDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
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

  describe("descriptor from convention", () => {
    it("uses the provided version", async () => {
      const { descriptor } = await loader.loadFromDirectory(tempDir, "2.1.0");
      expect(descriptor.version).toBe("2.1.0");
    });

    it("returns the 4 hardcoded content sections", async () => {
      const { descriptor } = await loader.loadFromDirectory(tempDir, "1.0.0");
      const names = descriptor.contentSections.map((s) => s.name);
      expect(names).toContain("agents");
      expect(names).toContain("commands");
      expect(names).toContain("rules");
      expect(names).toContain("skills");
    });

    it("skills section has SKILL.md as entryFile", async () => {
      const { descriptor } = await loader.loadFromDirectory(tempDir, "1.0.0");
      expect(descriptor.getContentSection("skills")?.entryFile).toBe("SKILL.md");
    });

    it("exposes agentsMd template ref", async () => {
      const { descriptor } = await loader.loadFromDirectory(tempDir, "1.0.0");
      expect(descriptor.getTemplate("agentsMd")?.path).toBe("aidd_docs/templates/AGENTS.md");
    });

    it("exposes mcp config ref", async () => {
      const { descriptor } = await loader.loadFromDirectory(tempDir, "1.0.0");
      expect(descriptor.getConfig("mcp")?.path).toBe("config/mcp.json");
    });
  });

  describe("loading content files", () => {
    it("loads agents files", async () => {
      await createDir(join(tempDir, "agents"));
      await writeFile(join(tempDir, "agents", "my-agent.md"), "# Agent", "utf-8");

      const { contentFiles } = await loader.loadFromDirectory(tempDir, "1.0.0");
      expect(contentFiles.has(join("agents", "my-agent.md"))).toBe(true);
      expect(contentFiles.get(join("agents", "my-agent.md"))).toBe("# Agent");
    });

    it("loads files from multiple sections", async () => {
      await createDir(join(tempDir, "agents"));
      await createDir(join(tempDir, "rules"));
      await writeFile(join(tempDir, "agents", "agent.md"), "agent content", "utf-8");
      await writeFile(join(tempDir, "rules", "rule.md"), "rule content", "utf-8");

      const { contentFiles } = await loader.loadFromDirectory(tempDir, "1.0.0");
      expect(contentFiles.has(join("agents", "agent.md"))).toBe(true);
      expect(contentFiles.has(join("rules", "rule.md"))).toBe(true);
    });

    it("content file keys are relative paths without leading slash", async () => {
      await createDir(join(tempDir, "agents"));
      await writeFile(join(tempDir, "agents", "agent.md"), "", "utf-8");

      const { contentFiles } = await loader.loadFromDirectory(tempDir, "1.0.0");
      for (const key of contentFiles.keys()) {
        expect(key).not.toMatch(/^\//);
      }
    });

    it("loads nested files recursively", async () => {
      await createDir(join(tempDir, "commands", "04_code"));
      await writeFile(join(tempDir, "commands", "04_code", "implement.md"), "implement", "utf-8");

      const { contentFiles } = await loader.loadFromDirectory(tempDir, "1.0.0");
      expect(contentFiles.has(join("commands", "04_code", "implement.md"))).toBe(true);
    });

    it("returns empty contentFiles when a section directory does not exist", async () => {
      const { contentFiles } = await loader.loadFromDirectory(tempDir, "1.0.0");
      expect(contentFiles.size).toBe(0);
    });
  });

  describe("with the real test fixture", () => {
    const FIXTURE_DIR = join(process.cwd(), "tests", "fixtures", "framework");
    const FIXTURE_VERSION = "1.0.0";

    it("loads all 4 content sections from the fixture", async () => {
      const { contentFiles } = await loader.loadFromDirectory(FIXTURE_DIR, FIXTURE_VERSION);
      const paths = [...contentFiles.keys()];
      expect(paths.some((p) => p.startsWith("agents/"))).toBe(true);
      expect(paths.some((p) => p.startsWith("commands/"))).toBe(true);
      expect(paths.some((p) => p.startsWith("rules/"))).toBe(true);
      expect(paths.some((p) => p.startsWith("skills/"))).toBe(true);
    });

    it("preserves phase subfolder structure and skill entry file paths", async () => {
      const { contentFiles } = await loader.loadFromDirectory(FIXTURE_DIR, FIXTURE_VERSION);
      const paths = [...contentFiles.keys()];
      expect(paths.some((p) => /^commands\/\d+_/.test(p))).toBe(true);
      expect(paths.some((p) => /^skills\/.+\/SKILL\.md$/.test(p))).toBe(true);
    });
  });

  describe("OS file filtering", () => {
    it("excludes .DS_Store files from content sections", async () => {
      await createDir(join(tempDir, "agents"));
      await writeFile(join(tempDir, "agents", "my-agent.md"), "# Agent", "utf-8");
      await writeFile(join(tempDir, "agents", ".DS_Store"), Buffer.alloc(0));

      const { contentFiles } = await loader.loadFromDirectory(tempDir, "1.0.0");
      const keys = [...contentFiles.keys()];
      expect(keys.some((k) => k.includes(".DS_Store"))).toBe(false);
      expect(contentFiles.has(join("agents", "my-agent.md"))).toBe(true);
    });

    it("excludes Thumbs.db files from content sections", async () => {
      await createDir(join(tempDir, "rules"));
      await writeFile(join(tempDir, "rules", "rule.md"), "# Rule", "utf-8");
      await writeFile(join(tempDir, "rules", "Thumbs.db"), Buffer.alloc(0));

      const { contentFiles } = await loader.loadFromDirectory(tempDir, "1.0.0");
      const keys = [...contentFiles.keys()];
      expect(keys.some((k) => k.includes("Thumbs.db"))).toBe(false);
    });

    it("excludes .DS_Store from docs files", async () => {
      const docsDir = join(tempDir, "aidd_docs");
      await createDir(docsDir);
      await writeFile(join(docsDir, "README.md"), "# Docs", "utf-8");
      await writeFile(join(docsDir, ".DS_Store"), Buffer.alloc(0));

      const { docsFiles } = await loader.loadFromDirectory(tempDir, "1.0.0");
      const keys = [...docsFiles.keys()];
      expect(keys.some((k) => k.includes(".DS_Store"))).toBe(false);
      expect(docsFiles.has(join("aidd_docs", "README.md"))).toBe(true);
    });
  });

  describe("docsFiles loading", () => {
    it("includes .gitkeep files with empty string content", async () => {
      const docsDir = join(tempDir, "aidd_docs", "memory", "internal");
      await mkdir(docsDir, { recursive: true });
      await writeFile(join(docsDir, ".gitkeep"), "", "utf-8");

      const { docsFiles } = await loader.loadFromDirectory(tempDir, "1.0.0");
      const gitkeepKey = join("aidd_docs", "memory", "internal", ".gitkeep");
      expect(docsFiles.has(gitkeepKey)).toBe(true);
      expect(docsFiles.get(gitkeepKey)).toBe("");
    });

    it("includes regular docs files with their content", async () => {
      const docsDir = join(tempDir, "aidd_docs");
      await mkdir(docsDir, { recursive: true });
      await writeFile(join(docsDir, "README.md"), "# Docs", "utf-8");

      const { docsFiles } = await loader.loadFromDirectory(tempDir, "1.0.0");
      const readmeKey = join("aidd_docs", "README.md");
      expect(docsFiles.has(readmeKey)).toBe(true);
      expect(docsFiles.get(readmeKey)).toBe("# Docs");
    });

    it("returns empty docsFiles when aidd_docs directory does not exist", async () => {
      const { docsFiles } = await loader.loadFromDirectory(tempDir, "1.0.0");
      expect(docsFiles.size).toBe(0);
    });
  });
});

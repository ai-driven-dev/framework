import { cp, mkdtemp, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFrameworkBuildUseCase } from "../../../../../src/composition/contexts/translate.js";
import { BundledAssetProviderAdapter } from "../../../../../src/shared/infrastructure/asset-loader.js";
import { FileAdapter } from "../../../../../src/shared/infrastructure/file-adapter.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { REPOSITORY_ROOT } from "../../../../shared/testing/repository-root.builder.js";

const FIXTURE_DIR = join(REPOSITORY_ROOT, "cli", "tests", "fixtures", "framework");
const AGENTS = "plugins/aidd-test/agents";

let source: string;
let out: string;
let logger: CapturingLogger;

beforeEach(async () => {
  source = await realpath(await mkdtemp(join(tmpdir(), "aidd-kimi-plugin-src-")));
  out = await realpath(await mkdtemp(join(tmpdir(), "aidd-kimi-plugin-out-")));
  await cp(FIXTURE_DIR, source, { recursive: true });
  await writeFile(
    join(source, AGENTS, "tooled.md"),
    "---\nname: tooled\ndescription: Declares Claude tools.\nmodel: sonnet\ntools: Read, WebFetch, Task, mcp__github__*, NotebookEdit\n---\n\nBody.\n"
  );
  logger = new CapturingLogger();
});

afterEach(async () => {
  await rm(source, { recursive: true, force: true });
  await rm(out, { recursive: true, force: true });
});

async function buildKimiPlugin(): Promise<void> {
  const useCase = createFrameworkBuildUseCase(
    registeredTools(),
    {
      fs: new FileAdapter(logger),
      assetProvider: new BundledAssetProviderAdapter(registeredTools()),
      logger,
    },
    { target: TOOL.kimi, mode: "marketplace", outDir: out, force: false }
  );
  if (useCase === undefined) throw new Error("kimi:marketplace must be wired");
  await useCase.execute({ sourceDir: source, outDir: out, target: TOOL.kimi, mode: "marketplace" });
}

async function files(): Promise<string[]> {
  const entries = await readdir(out, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      join(entry.parentPath, entry.name)
        .slice(out.length + 1)
        .replaceAll("\\", "/")
    )
    .sort();
}

function frontmatterOf(markdown: string): Record<string, string> {
  const block = /^---\n([\s\S]*?)\n---/.exec(markdown)?.[1] ?? "";
  return Object.fromEntries(
    block.split("\n").map((line) => {
      const at = line.indexOf(":");
      return [line.slice(0, at), line.slice(at + 1).trim()];
    })
  );
}

describe("a plugin build for kimi", () => {
  it("builds each plugin as a tree with Kimi's own manifest, skills and agents", async () => {
    await buildKimiPlugin();

    const built = await files();
    expect(built).toContain("plugins/aidd-test/.kimi-plugin/plugin.json");
    expect(built).toContain("plugins/aidd-test/skills/commit/SKILL.md");
    expect(built).toContain("plugins/aidd-test/agents/code-reviewer.md");
    expect(built.filter((path) => path.includes(".mcp.json"))).toEqual([]);
    expect(built.filter((path) => path.startsWith("plugins/aidd-test/hooks/"))).toEqual([]);
  });

  it("names the skills with a ./ path and carries the servers inline with the plugin root resolved", async () => {
    await buildKimiPlugin();

    const manifest = JSON.parse(
      await readFile(join(out, "plugins/aidd-test/.kimi-plugin/plugin.json"), "utf-8")
    );
    expect(manifest.skills).toBe("./skills/");
    expect(manifest.mcpServers).toEqual({
      "aidd-test-server": { command: "./bin/server.js", args: [] },
    });
  });

  it("writes the kimi names of declared tools and no model", async () => {
    await buildKimiPlugin();

    const agent = await readFile(join(out, "plugins/aidd-test/agents/tooled.md"), "utf-8");
    const frontmatter = frontmatterOf(agent);
    expect(frontmatter.tools).toBe('["Read","FetchURL","Agent","mcp__github__*"]');
    expect(frontmatter.model).toBeUndefined();
  });
});

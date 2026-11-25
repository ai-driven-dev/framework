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
// Avoid biome noTemplateCurlyInString: split literal for the placeholder.
const CLAUDE_ROOT_VAR = "$" + "{CLAUDE_PLUGIN_ROOT}";

let source: string;
let out: string;
let logger: CapturingLogger;

beforeEach(async () => {
  source = await realpath(await mkdtemp(join(tmpdir(), "aidd-kimi-src-")));
  out = await realpath(await mkdtemp(join(tmpdir(), "aidd-kimi-out-")));
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

async function buildKimi(): Promise<void> {
  const useCase = createFrameworkBuildUseCase(
    registeredTools(),
    {
      fs: new FileAdapter(logger),
      assetProvider: new BundledAssetProviderAdapter(registeredTools()),
      logger,
    },
    { target: TOOL.kimi, mode: "flat", outDir: out, force: false }
  );
  if (useCase === undefined) throw new Error("kimi:flat must be wired");
  await useCase.execute({ sourceDir: source, outDir: out, target: TOOL.kimi, mode: "flat" });
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

describe("a flat build for kimi", () => {
  it("puts skills where kimi and the shared skills folder read them, and agents in kimi's own folder", async () => {
    await buildKimi();

    const built = await files();
    expect(built).toContain(".agents/skills/aidd-test-commit/SKILL.md");
    expect(built).toContain(".kimi-code/agents/aidd-test-code-reviewer.md");
    expect(built.filter((path) => path.startsWith(".agents/agents/"))).toEqual([]);
    expect(built.filter((path) => path.startsWith(".kimi-code/skills/"))).toEqual([]);
  });

  it("names the agent and states no model and no tools when the source declares none", async () => {
    await buildKimi();

    const agent = await readFile(
      join(out, ".kimi-code/agents/aidd-test-code-reviewer.md"),
      "utf-8"
    );
    expect(frontmatterOf(agent)).toEqual({
      name: "'aidd-test-code-reviewer'",
      description: "'Reviews code for quality and correctness.'",
    });
  });

  it("writes the kimi names of declared tools, keeps MCP globs and drops a name kimi lacks", async () => {
    await buildKimi();

    const agent = await readFile(join(out, ".kimi-code/agents/aidd-test-tooled.md"), "utf-8");
    const frontmatter = frontmatterOf(agent);
    expect(frontmatter.tools).toBe('["Read","FetchURL","Agent","mcp__github__*"]');
    expect(frontmatter.model).toBeUndefined();
  });

  it("writes the plugin's servers to kimi's MCP file with the plugin root resolved", async () => {
    await buildKimi();

    const raw = await readFile(join(out, ".kimi-code/mcp.json"), "utf-8");
    expect(raw).not.toContain(CLAUDE_ROOT_VAR);
    const servers = Object.keys(JSON.parse(raw).mcpServers);
    expect(servers.some((name) => name.startsWith("aidd-test-"))).toBe(true);
  });

  it("ships no hooks, and says so", async () => {
    await buildKimi();

    expect((await files()).filter((path) => /hooks/.test(path))).toEqual([]);
    expect(logger.warnMessages).toContain(
      "Skipping hooks/ in plugin 'aidd-test' (hooks not supported for this target)."
    );
  });
});

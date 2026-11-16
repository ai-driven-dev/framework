import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { wireTools } from "../../../../../src/composition/tools.js";
import { createFrameworkBuildUseCase } from "../../../../../src/composition/translate.js";
import { BundledAssetProviderAdapter } from "../../../../../src/contexts/installation/infrastructure/assets/asset-loader.js";
import { HasherAdapter } from "../../../../../src/contexts/installation/infrastructure/hasher-adapter.js";
import type { FrameworkBuildTarget } from "../../../../../src/contexts/translate/contract/build-targets.js";
import {
  FlatMergeTargetNotJsonError,
  FlatTargetExistsError,
} from "../../../../../src/shared/domain/errors.js";
import { FileAdapter } from "../../../../../src/shared/infrastructure/file-adapter.js";
import { FRAMEWORK_REAL } from "../../../../helpers/fixture-setup.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { REPOSITORY_ROOT } from "../../../../helpers/repository-root.js";
import { catalogOf, TOOL } from "../../../tools/testing/catalog-of.js";

const FIXTURE_DIR = join(REPOSITORY_ROOT, "cli", "tests", "fixtures", "framework");
// Avoid biome noTemplateCurlyInString: split literal for the placeholder.
const CLAUDE_ROOT_VAR = "$" + "{CLAUDE_PLUGIN_ROOT}";

let out: string;

beforeEach(async () => {
  out = await realpath(await mkdtemp(join(tmpdir(), "aidd-flat-targets-")));
});

afterEach(async () => {
  await rm(out, { recursive: true, force: true });
});

/** The real file system, the real schemas and the real wiring the `translate` command uses. */
async function buildFlat(
  target: FrameworkBuildTarget,
  options: { source?: string; force?: boolean } = {}
): Promise<void> {
  const logger = new CapturingLogger();
  const useCase = createFrameworkBuildUseCase(
    catalogOf(),
    {
      fs: new FileAdapter(new HasherAdapter(), logger),
      assetProvider: new BundledAssetProviderAdapter(wireTools()),
      logger,
    },
    { target, mode: "flat", outDir: out, force: options.force ?? false }
  );
  if (useCase === undefined) throw new Error(`${target}:flat must be wired`);
  await useCase.execute({
    sourceDir: options.source ?? FIXTURE_DIR,
    outDir: out,
    target,
    mode: "flat",
  });
}

async function hashTree(dir: string): Promise<Map<string, string>> {
  const hashes = new Map<string, string>();
  for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    hashes.set(
      path,
      createHash("md5")
        .update(await readFile(path))
        .digest("hex")
    );
  }
  return hashes;
}

describe("a flat build into a tree a first build already wrote", () => {
  it("is byte-identical when forced, and halts when not", async () => {
    await buildFlat(TOOL.copilot);
    const first = await hashTree(out);

    await buildFlat(TOOL.copilot, { force: true });
    const second = await hashTree(out);

    expect(first.size).toBeGreaterThan(0);
    expect(second).toEqual(first);
    await expect(buildFlat(TOOL.copilot)).rejects.toBeInstanceOf(FlatTargetExistsError);
  });
});

describe("a flat build into a project that already holds a server of the person's own", () => {
  it("drops the Claude plugin root, prefixes the plugin's servers and keeps the person's", async () => {
    await mkdir(join(out, ".vscode"), { recursive: true });
    const existingMcp = {
      servers: { "my-existing-server": { command: "node", args: ["server.js"] } },
    };
    await writeFile(join(out, ".vscode", "mcp.json"), JSON.stringify(existingMcp, null, 2));

    await buildFlat(TOOL.copilot);

    const agent = join(out, ".github", "agents", "aidd-test-code-reviewer.agent.md");
    expect(await readFile(agent, "utf-8")).not.toContain(CLAUDE_ROOT_VAR);
    const hooks = join(out, ".github", "hooks", "aidd-test.hooks.json");
    expect(await readFile(hooks, "utf-8")).not.toContain(CLAUDE_ROOT_VAR);
    const mcpRaw = await readFile(join(out, ".vscode", "mcp.json"), "utf-8");
    expect(mcpRaw).not.toContain(CLAUDE_ROOT_VAR);
    // Written "/"-separated on purpose: a backslash-native path embedded in JSON comes back
    // doubly escaped, and a forward slash is valid on Windows too.
    expect(mcpRaw).toContain(out.replace(/\\/g, "/"));
    const servers = (JSON.parse(mcpRaw) as { servers: Record<string, unknown> }).servers;
    expect(
      Object.keys(servers).filter((key) => key.startsWith("aidd-test-")).length
    ).toBeGreaterThan(0);
    expect(servers["my-existing-server"]).toBeDefined();
  });
});

describe("a flat build for antigravity into a hooks file that is not JSON", () => {
  it("names the file and leaves it untouched", async () => {
    await mkdir(join(out, ".agents"), { recursive: true });
    const hooksFile = join(out, ".agents", "hooks.json");
    await writeFile(hooksFile, "{ not json");

    const build = buildFlat(TOOL.antigravity, { source: FRAMEWORK_REAL });

    await expect(build).rejects.toBeInstanceOf(FlatMergeTargetNotJsonError);
    await expect(build).rejects.toThrow(".agents/hooks.json is not valid JSON");
    await expect(build).rejects.toThrow("left untouched");
    expect(await readFile(hooksFile, "utf-8")).toBe("{ not json");
  });
});

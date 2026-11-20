import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { wireTools } from "../../src/composition/tools.js";
import { createFrameworkBuildUseCase } from "../../src/composition/translate.js";
import { BundledAssetProviderAdapter } from "../../src/shared/infrastructure/asset-loader.js";
import { catalogOf } from "../contexts/tools/testing/catalog-of.js";
import { REPOSITORY_ROOT } from "../helpers/repository-root.js";
import { CapturingLogger } from "../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../shared/testing/in-memory-file-adapter.fake.js";
import { TOOL } from "../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../shared/testing/seed-from-directory.builder.js";

const FIXTURE_DIR = join(REPOSITORY_ROOT, "cli", "tests", "fixtures", "framework");

describe("createFrameworkBuildUseCase, by mode", () => {
  let outDir: string;
  let fs: InMemoryFileAdapter;

  beforeEach(async () => {
    outDir = await mkdtemp(join(tmpdir(), "aidd-build-modes-"));
    fs = new InMemoryFileAdapter();
    await seedFromDirectory(fs, FIXTURE_DIR, { useAbsolutePaths: true });
    fs.setFile(`${outDir}/.keep`, "");
  });

  afterEach(async () => {
    await rm(outDir, { recursive: true, force: true });
  });

  function useCaseFor(target: "claude" | "copilot", mode: "marketplace" | "flat") {
    const useCase = createFrameworkBuildUseCase(
      catalogOf(),
      {
        fs,
        assetProvider: new BundledAssetProviderAdapter(wireTools()),
        logger: new CapturingLogger(),
      },
      { target, mode, outDir, force: true }
    );
    if (useCase === undefined) throw new Error(`${target}:${mode} must be wired`);
    return useCase;
  }

  it("builds a marketplace tree, plugin directories included, in marketplace mode", async () => {
    await useCaseFor("claude", "marketplace").execute({
      sourceDir: FIXTURE_DIR,
      outDir,
      target: TOOL.claude,
    });

    expect(fs.has(`${outDir}/.claude-plugin/marketplace.json`)).toBe(true);
    expect(fs.listUnder(`${outDir}/.github`)).toStrictEqual([]);
  });

  it("builds a flat tree, no marketplace catalog, in flat mode", async () => {
    await useCaseFor("copilot", "flat").execute({
      sourceDir: FIXTURE_DIR,
      outDir,
      target: TOOL.copilot,
    });

    expect(fs.has(`${outDir}/.claude-plugin/marketplace.json`)).toBe(false);
    expect(fs.listUnder(`${outDir}/.github/agents`).length).toBeGreaterThan(0);
  });
});

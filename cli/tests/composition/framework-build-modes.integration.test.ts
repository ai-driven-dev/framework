import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { wireTools } from "../../src/composition/tools.js";
import { createFrameworkBuildUseCase } from "../../src/composition/translate.js";
import { BundledAssetProviderAdapter } from "../../src/contexts/framework/infrastructure/assets/asset-loader.js";
import { OutDirNotDirectoryError } from "../../src/shared/domain/errors.js";
import { catalogOf, TOOL } from "../contexts/tools/testing/catalog-of.js";
import { CapturingLogger } from "../helpers/ports/capturing-logger.js";
import { InMemoryFileAdapter } from "../helpers/ports/in-memory-file-adapter.js";
import { seedFromDirectory } from "../helpers/ports/seed-from-directory.js";
import { REPOSITORY_ROOT } from "../helpers/repository-root.js";

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

  function useCaseFor(target: "claude" | "copilot", mode: "marketplace" | "flat", dir = outDir) {
    const useCase = createFrameworkBuildUseCase(
      catalogOf(),
      {
        fs,
        assetProvider: new BundledAssetProviderAdapter(wireTools()),
        logger: new CapturingLogger(),
      },
      { target, mode, outDir: dir, force: true }
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

  it("refuses a flat build into a directory that is not there on disk", async () => {
    const gone = join(outDir, "gone");
    fs.setFile(`${gone}/.keep`, "");

    await expect(
      useCaseFor("copilot", "flat", gone).execute({
        sourceDir: FIXTURE_DIR,
        outDir: gone,
        target: TOOL.copilot,
      })
    ).rejects.toBeInstanceOf(OutDirNotDirectoryError);
  });
});

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OutDirNotDirectoryError } from "../../../src/kernel/errors.js";
import { BundledAssetProviderAdapter } from "../../../src/runtime/assets/asset-loader.js";
import { createFrameworkBuildUseCase } from "../../../src/runtime/wiring/translate.js";
import { CapturingLogger } from "../../helpers/ports/capturing-logger.js";
import { InMemoryFileAdapter } from "../../helpers/ports/in-memory-file-adapter.js";
import { seedFromDirectory } from "../../helpers/ports/seed-from-directory.js";
import { REPOSITORY_ROOT } from "../../helpers/repository-root.js";

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

  it("builds a marketplace tree, plugin directories included, in marketplace mode", async () => {
    const useCase = createFrameworkBuildUseCase(
      { fs, assetProvider: new BundledAssetProviderAdapter(), logger: new CapturingLogger() },
      { target: "claude", mode: "marketplace", outDir, force: true }
    );
    if (useCase === undefined) throw new Error("claude:marketplace must be wired");

    await useCase.execute({ sourceDir: FIXTURE_DIR, outDir, target: "claude" });

    expect(fs.has(`${outDir}/.claude-plugin/marketplace.json`)).toBe(true);
    expect(fs.listUnder(`${outDir}/.github`)).toStrictEqual([]);
  });

  it("builds a flat tree, no marketplace catalog, in flat mode", async () => {
    const useCase = createFrameworkBuildUseCase(
      { fs, assetProvider: new BundledAssetProviderAdapter(), logger: new CapturingLogger() },
      { target: "copilot", mode: "flat", outDir, force: true }
    );
    if (useCase === undefined) throw new Error("copilot:flat must be wired");

    await useCase.execute({ sourceDir: FIXTURE_DIR, outDir, target: "copilot" });

    expect(fs.has(`${outDir}/.claude-plugin/marketplace.json`)).toBe(false);
    expect(fs.listUnder(`${outDir}/.github/agents`).length).toBeGreaterThan(0);
  });

  it("refuses a flat build into a directory that is not there on disk", async () => {
    const gone = join(outDir, "gone");
    fs.setFile(`${gone}/.keep`, "");
    const useCase = createFrameworkBuildUseCase(
      { fs, assetProvider: new BundledAssetProviderAdapter(), logger: new CapturingLogger() },
      { target: "copilot", mode: "flat", outDir: gone, force: true }
    );
    if (useCase === undefined) throw new Error("copilot:flat must be wired");

    await expect(
      useCase.execute({ sourceDir: FIXTURE_DIR, outDir: gone, target: "copilot" })
    ).rejects.toBeInstanceOf(OutDirNotDirectoryError);
  });
});

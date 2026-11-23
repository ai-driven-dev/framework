import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { wireTools } from "../../src/composition/contexts/tools.js";
import {
  createFrameworkBuildUseCase,
  type FrameworkBuildDeps,
} from "../../src/composition/contexts/translate.js";
import { FlatTargetExistsError } from "../../src/contexts/translate/domain/translate.error.js";
import { BundledAssetProviderAdapter } from "../../src/shared/infrastructure/asset-loader.js";
import { CapturingLogger } from "../shared/testing/capturing-logger.fake.js";
import { catalogOf } from "../shared/testing/catalog-of.builder.js";
import { InMemoryFileAdapter } from "../shared/testing/in-memory-file-adapter.fake.js";
import { TOOL } from "../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../shared/testing/seed-from-directory.builder.js";

const FIXTURE_DIR = resolve(process.cwd(), "tests/fixtures/framework");
// Canonical flat destination for the fixture's "aidd-test" plugin agent, under --target copilot.
const COLLIDING_RELATIVE_PATH = ".github/agents/aidd-test-code-reviewer.agent.md";
const STALE_CONTENT = "stale content from a previous build";

function makeDeps(fs: InMemoryFileAdapter): FrameworkBuildDeps {
  return {
    fs,
    assetProvider: new BundledAssetProviderAdapter(wireTools()),
    logger: new CapturingLogger(),
  };
}

describe("createFrameworkBuildUseCase threads the caller's --force through to the flat sink", () => {
  let outDir: string;
  let fs: InMemoryFileAdapter;

  beforeEach(async () => {
    outDir = await mkdtemp(join(tmpdir(), "aidd-force-wiring-"));
    fs = new InMemoryFileAdapter();
    await seedFromDirectory(fs, FIXTURE_DIR, { useAbsolutePaths: true });
    // outDir must exist for both the in-memory fs (fileExists) and the real disk
    // (the flat sink's directory guard).
    fs.setFile(`${outDir}/.keep`, "");
    fs.setFile(`${outDir}/${COLLIDING_RELATIVE_PATH}`, STALE_CONTENT);
  });

  afterEach(async () => {
    await rm(outDir, { recursive: true, force: true });
  });

  function flatCopilot(force: boolean) {
    const useCase = createFrameworkBuildUseCase(catalogOf(), makeDeps(fs), {
      target: "copilot",
      mode: "flat",
      outDir,
      force,
    });
    if (useCase === undefined) throw new Error("copilot:flat must be wired in the registry");
    return useCase.execute({ sourceDir: FIXTURE_DIR, outDir, target: TOOL.copilot });
  }

  it("force: false throws FlatTargetExistsError when the canonical destination already exists", async () => {
    await expect(flatCopilot(false)).rejects.toBeInstanceOf(FlatTargetExistsError);
    expect(fs.getFile(`${outDir}/${COLLIDING_RELATIVE_PATH}`)).toBe(STALE_CONTENT);
  });

  it("force: true overwrites the canonical destination instead of throwing", async () => {
    await flatCopilot(true);

    const written = fs.getFile(`${outDir}/${COLLIDING_RELATIVE_PATH}`);
    expect(written).not.toBe(STALE_CONTENT);
    expect(written).toContain("aidd-test-code-reviewer");
  });
});

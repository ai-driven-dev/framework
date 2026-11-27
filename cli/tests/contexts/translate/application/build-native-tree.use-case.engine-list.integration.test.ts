import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { FrameworkBuildMode } from "../../../../src/contexts/tools/contract/tool-profile.js";
import { translate } from "../../../../src/contexts/translate/domain/engine.js";
import type { OutputFile } from "../../../../src/contexts/translate/domain/output-file.js";
import { BundledSchemaProviderAdapter } from "../../../../src/contexts/translate/infrastructure/schema-provider.js";
import { AjvSchemaValidatorAdapter } from "../../../../src/contexts/translate/infrastructure/schema-validator.js";
import type { ToolBuildContract } from "../../../../src/shared/domain/materialization/build-contract.js";
import { posixRelative } from "../../../../src/shared/domain/paths.model.js";
import { BundledAssetProviderAdapter } from "../../../../src/shared/infrastructure/asset-loader.js";
import { CapturingLogger } from "../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools } from "../../../shared/testing/registered-tools.builder.js";
import { seedFromDirectory } from "../../../shared/testing/seed-from-directory.builder.js";
import { BUILD_ONLY_FOLDS, foldFilesOf } from "../testing/build-only-folds.builder.js";
import { buildTree } from "../testing/build-tree.builder.js";
import {
  distributionOf,
  FRAMEWORK_SOURCE,
} from "../testing/framework-real-distribution.builder.js";

const OUT = resolve("/engine-list-out").replaceAll("\\", "/");
const MARKETPLACE_TARGETS = ["copilot", "codex", "claude", "cursor"] as const;
const tools = registeredTools();
const CELLS = [
  ...MARKETPLACE_TARGETS.map((target) => ({ target, mode: "marketplace" as const })),
  ...tools.idsInCanonicalOrder("ai").map((target) => ({ target, mode: "flat" as const })),
];

async function build(
  seeded: InMemoryFileAdapter,
  target: string,
  mode: FrameworkBuildMode
): Promise<InMemoryFileAdapter> {
  const fs = new InMemoryFileAdapter();
  for (const path of seeded.listAll()) fs.setFile(path, seeded.getFile(path) ?? "");
  await fs.createDirectory(OUT);
  const id = tools.aiToolId(target);
  if (id === null) throw new Error(`${target} is not an AI tool`);
  const contract = tools.aiProfile(id).buildContract(mode);
  if (contract === null) throw new Error(`no ${mode} contract for ${target}`);
  const assets = new BundledAssetProviderAdapter(tools);
  const use = buildTree(
    fs,
    new AjvSchemaValidatorAdapter(),
    assets,
    new CapturingLogger(),
    contract,
    mode,
    false,
    new BundledSchemaProviderAdapter()
  );
  await use.execute({ sourceDir: FRAMEWORK_SOURCE, outDir: OUT, target: id, mode });
  return fs;
}

function listedBy(
  seeded: InMemoryFileAdapter,
  contract: ToolBuildContract,
  mode: FrameworkBuildMode
): OutputFile[] {
  return readdirSync(join(FRAMEWORK_SOURCE, "plugins")).flatMap(
    (name) =>
      translate(distributionOf(seeded, name), { kind: "build", contract, mode, outDir: OUT }).files
  );
}

describe("the engine's file list against what a build writes", () => {
  let seeded: InMemoryFileAdapter;
  beforeAll(async () => {
    seeded = new InMemoryFileAdapter();
    await seedFromDirectory(seeded, FRAMEWORK_SOURCE, { useAbsolutePaths: true });
  });

  it.each(CELLS)(
    "$target $mode: every file the engine lists is written as listed",
    async ({ target, mode }) => {
      const id = tools.aiToolId(target);
      const contract = id === null ? null : tools.aiProfile(id).buildContract(mode);
      if (contract === null) throw new Error(`no ${mode} contract for ${target}`);
      const built = await build(seeded, target, mode);
      const listed = listedBy(seeded, contract, mode);

      expect(listed.length, "the engine lists files for this cell").toBeGreaterThan(0);
      const written = listed.map((file) => [
        file.relativePath,
        built.getFile(join(OUT, file.relativePath)),
      ]);
      expect(written).toEqual(listed.map((file) => [file.relativePath, file.content]));
    }
  );

  it.each(CELLS)(
    "$target $mode: a build writes nothing the engine does not list, bar the declared build-only folds",
    async ({ target, mode }) => {
      const id = tools.aiToolId(target);
      const contract = id === null ? null : tools.aiProfile(id).buildContract(mode);
      if (contract === null) throw new Error(`no ${mode} contract for ${target}`);
      const built = await build(seeded, target, mode);
      const listed = new Set(listedBy(seeded, contract, mode).map((file) => file.relativePath));
      const unlisted = built
        .listUnder(OUT)
        .map((path) => posixRelative(OUT, path, process.platform))
        .filter((path) => !listed.has(path))
        .sort();

      const folds = foldFilesOf(
        { target, mode, contract },
        readdirSync(join(FRAMEWORK_SOURCE, "plugins"))
      );
      expect(Object.keys(folds).every((fold) => BUILD_ONLY_FOLDS.includes(fold))).toBe(true);
      expect(unlisted).toEqual(Object.values(folds).flat().sort());
    }
  );
});

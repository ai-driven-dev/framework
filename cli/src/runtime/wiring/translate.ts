import { stat } from "node:fs/promises";
import type { ToolBuildContract } from "../../contexts/tools/contract/build-contract.js";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import {
  FRAMEWORK_BUILD_MODES,
  type FrameworkBuildMode,
} from "../../contexts/tools/contract/tool-profile.js";
import { FlatBuildStrategy } from "../../contexts/translate/application/strategies/flat-build-strategy.js";
import { MarketplaceBuildStrategy } from "../../contexts/translate/application/strategies/marketplace-build-strategy.js";
import { FrameworkBuildUseCase } from "../../contexts/translate/application/translate-source.js";
import { AjvSchemaValidatorAdapter } from "../../contexts/translate/infrastructure/schema-validator.js";
import type { AssetProvider } from "../../kernel/ports/asset-provider.js";
import type { FileReader } from "../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../kernel/ports/file-writer.js";
import type { Logger } from "../../kernel/ports/logger.js";
import { isAiToolId } from "../../kernel/tool.js";
import type { FileMerger } from "../../shared/ports/file-merger.js";

export interface FrameworkBuildDeps {
  fs: FileReader & FileWriter & FileMerger;
  assetProvider: AssetProvider;
  logger: Logger;
}

export interface FrameworkBuildContext {
  readonly target: string;
  readonly mode: string;
  readonly outDir: string;
  readonly force: boolean;
}

type FrameworkBuildFactory = (
  deps: FrameworkBuildDeps,
  ctx: FrameworkBuildContext
) => FrameworkBuildUseCase;

function buildFrameworkUseCase(
  deps: FrameworkBuildDeps,
  makeStrategy: (
    deps: FrameworkBuildDeps,
    av: AjvSchemaValidatorAdapter
  ) => MarketplaceBuildStrategy | FlatBuildStrategy
): FrameworkBuildUseCase {
  const av = new AjvSchemaValidatorAdapter();
  return new FrameworkBuildUseCase(
    deps.fs,
    av,
    deps.assetProvider,
    deps.logger,
    makeStrategy(deps, av)
  );
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

function frameworkBuildFactoryFor(
  buildContract: () => ToolBuildContract,
  mode: FrameworkBuildMode
): FrameworkBuildFactory {
  if (mode === "marketplace") {
    return (deps, ctx) =>
      buildFrameworkUseCase(
        deps,
        (d, av) =>
          new MarketplaceBuildStrategy(d.fs, av, d.assetProvider, buildContract(), ctx.force)
      );
  }
  return (deps, ctx) =>
    buildFrameworkUseCase(
      deps,
      (d) =>
        new FlatBuildStrategy(
          d.fs,
          d.assetProvider,
          buildContract(),
          ctx.force,
          ctx.outDir,
          isDirectory,
          d.logger
        )
    );
}

function isBuildMode(mode: string): mode is FrameworkBuildMode {
  return FRAMEWORK_BUILD_MODES.some((known) => known === mode);
}

/** The use case for the target and mode the catalog's profile declares a build contract for, or
 * undefined when it declares none. */
export function createFrameworkBuildUseCase(
  tools: ToolCatalog,
  deps: FrameworkBuildDeps,
  ctx: FrameworkBuildContext
): FrameworkBuildUseCase | undefined {
  if (!isAiToolId(ctx.target) || !isBuildMode(ctx.mode)) return undefined;
  const profile = tools.profile(ctx.target);
  if (profile.kind !== "ai") return undefined;
  const buildContract = profile.buildContract(ctx.mode);
  if (buildContract === null) return undefined;
  return frameworkBuildFactoryFor(() => buildContract, ctx.mode)(deps, ctx);
}

import type { ToolCatalog } from "../contexts/tools/contract/tool-catalog.js";
import { DiskSink } from "../contexts/translate/application/sink/disk-sink.js";
import {
  BuildNativeTree,
  type FrameworkBuildContext,
} from "../contexts/translate/application/translate-source.js";
import { AjvSchemaValidatorAdapter } from "../contexts/translate/infrastructure/schema-validator.js";
import type { AssetProvider } from "../shared/ports/asset-provider.js";
import type { FileReader } from "../shared/ports/file-reader.js";
import type { FileWriter } from "../shared/ports/file-writer.js";
import type { Logger } from "../shared/ports/logger.js";

export interface FrameworkBuildDeps {
  fs: FileReader & FileWriter;
  assetProvider: AssetProvider;
  logger: Logger;
}

/** The use case for the target and mode the catalog's profile declares a build contract for, or
 * undefined when it declares none. */
export function createFrameworkBuildUseCase(
  tools: ToolCatalog,
  deps: FrameworkBuildDeps,
  ctx: FrameworkBuildContext
): BuildNativeTree | undefined {
  const target = tools.aiToolId(ctx.target);
  if (target === null) return undefined;
  const contract = tools.aiProfile(target).buildContract(ctx.mode, ctx.provider);
  if (contract === null) return undefined;
  const sink = new DiskSink(
    deps.fs,
    new AjvSchemaValidatorAdapter(),
    deps.assetProvider,
    deps.logger
  );
  return new BuildNativeTree(deps.fs, deps.logger, sink, {
    contract,
    mode: ctx.mode,
    force: ctx.force,
  });
}

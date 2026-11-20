import type { ToolBuildContract } from "../../../../src/contexts/tools/contract/build-contract.js";
import type { FrameworkBuildMode } from "../../../../src/contexts/tools/contract/tool-profile.js";
import { BuildNativeTree } from "../../../../src/contexts/translate/application/build-native-tree.js";
import { DiskSink } from "../../../../src/contexts/translate/application/sinks/disk-sink.js";
import type { JsonSchemaValidator } from "../../../../src/contexts/translate/ports/json-schema-validator.js";
import type { AssetProvider } from "../../../../src/shared/ports/asset-provider.js";
import type { FileReader } from "../../../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../../../src/shared/ports/file-writer.js";
import type { Logger } from "../../../../src/shared/ports/logger.js";

/** A build of one contract in one mode, over in-memory files: the real sink behind the real use case. */
export function buildTree(
  fs: FileReader & FileWriter,
  validator: JsonSchemaValidator,
  assetProvider: AssetProvider,
  logger: Logger,
  contract: ToolBuildContract,
  mode: FrameworkBuildMode,
  force = false
): BuildNativeTree {
  return new BuildNativeTree(fs, logger, new DiskSink(fs, validator, assetProvider, logger), {
    contract,
    mode,
    force,
  });
}

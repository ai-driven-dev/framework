import { DiskSink } from "../../../../src/contexts/translate/application/sinks/disk-sink.js";
import { FlatWriter } from "../../../../src/contexts/translate/application/sinks/flat-writer.js";
import type { JsonSchemaValidator } from "../../../../src/contexts/translate/ports/json-schema-validator.js";
import type { AssetProvider } from "../../../../src/shared/ports/asset-provider.js";
import type { FileReader } from "../../../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../../../src/shared/ports/file-writer.js";
import type { Logger } from "../../../../src/shared/ports/logger.js";

/** The disk sink with the flat writer it ships with, over the given files. */
export function aDiskSink(
  fs: FileReader & FileWriter,
  validator: JsonSchemaValidator,
  assetProvider: AssetProvider,
  logger: Logger
): DiskSink {
  return new DiskSink(
    fs,
    validator,
    assetProvider,
    logger,
    new FlatWriter(fs, assetProvider, logger)
  );
}

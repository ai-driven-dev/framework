import type { AssetProvider } from "../../../shared/ports/asset-provider.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../shared/ports/file-writer.js";
import type { Logger } from "../../../shared/ports/logger.js";
import type { FlatPluginWriter } from "./flat-plugin-writer.js";
import type { JsonSchemaValidator } from "./json-schema-validator.js";

/** What a disk sink writes through: the files, the schema check, the flat writer and the log. */
export interface DiskSinkDeps {
  readonly fs: FileReader & FileWriter;
  readonly jsonSchemaValidator: JsonSchemaValidator;
  readonly assetProvider: AssetProvider;
  readonly logger: Logger;
  readonly flat: FlatPluginWriter;
}

/** One plugin of a build: its name and the folder of its source. */
export interface PluginSource {
  readonly name: string;
  readonly src: string;
}

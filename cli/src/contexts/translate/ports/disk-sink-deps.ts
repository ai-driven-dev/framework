import type { AiToolId } from "../../../shared/domain/tool.js";
import type { AssetProvider } from "../../../shared/ports/asset-provider.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../shared/ports/file-writer.js";
import type { Logger } from "../../../shared/ports/logger.js";
import type { FlatPluginWriter } from "./flat-plugin-writer.js";
import type { JsonSchemaValidator } from "./json-schema-validator.js";
import type { SchemaProvider } from "./schema-provider.js";

/** What a disk sink writes through: the files, the schema check, the flat writer and the log. */
export interface DiskSinkDeps {
  readonly fs: FileReader & FileWriter;
  readonly jsonSchemaValidator: JsonSchemaValidator;
  readonly assetProvider: AssetProvider;
  readonly schemaProvider: SchemaProvider;
  readonly logger: Logger;
  readonly flat: FlatPluginWriter;
  /** The tool whose layout the framework's source plugins are written in. */
  readonly canonFormat: AiToolId;
}

/** One plugin of a build: its name and the folder of its source. */
export interface PluginSource {
  readonly name: string;
  readonly src: string;
}

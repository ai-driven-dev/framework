import type { PluginName } from "../../../shared/domain/plugin/plugin-name.js";
import type { AiToolId } from "../../../shared/domain/tool.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../shared/ports/file-writer.js";
import type { Logger } from "../../../shared/ports/logger.js";
import type { FlatPluginWriter } from "./flat-plugin-writer.js";
import type { SchemaCheck } from "./schema-check.js";

/** What a disk sink writes through: the files, the schema check, the flat writer and the log. */
export interface DiskSinkDeps {
  readonly fs: FileReader & FileWriter;
  readonly schemaCheck: SchemaCheck;
  readonly logger: Logger;
  readonly flat: FlatPluginWriter;
  readonly canon: CanonSource;
}

/** The tool whose layout the framework's source plugins are written in, and the platform whose
 * path rules spell their listing. */
export interface CanonSource {
  readonly format: AiToolId;
  readonly platform: string;
}

/** One plugin of a build: its name and the folder of its source. */
export interface PluginSource {
  readonly name: PluginName;
  readonly src: string;
}

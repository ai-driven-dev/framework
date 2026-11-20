import { resolve } from "node:path";
import { FileHash } from "../../../../shared/domain/file.js";
import { tryParseJson } from "../../../../shared/domain/reading/json-file.js";
import { asPlainObject } from "../../../../shared/domain/reading/plain-object.js";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { Manifest } from "../../domain/manifest.js";

/** A settings file a tool shares with its host, read leniently and written with its tracked hash
 * kept in step. */
export class TrackedSettingsFile {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly logger: Logger
  ) {}

  // These files are co-owned and the machine-local one is untracked and gitignored, which is
  // exactly the kind of file people hand-edit: a trailing comma must not take the whole sync
  // down with it.
  async load(projectRoot: string, settingsFile: string): Promise<Record<string, unknown>> {
    const absPath = resolve(projectRoot, settingsFile);
    if (!(await this.fs.fileExists(absPath))) return {};
    const parsed = tryParseJson(await this.fs.readFile(absPath));
    if (!parsed.ok) {
      this.logger.warn(`Ignoring malformed JSON in ${absPath}; rewriting the keys this CLI owns.`);
      return {};
    }
    return asPlainObject(parsed.value) ?? {};
  }

  async write(
    manifest: Manifest,
    toolId: ToolId,
    projectRoot: string,
    settingsFile: string,
    json: Record<string, unknown>
  ): Promise<void> {
    const content = JSON.stringify(json, null, 2);
    await this.fs.writeFile(resolve(projectRoot, settingsFile), content);
    manifest.recordFileHash(toolId, settingsFile, FileHash.of(content));
  }
}

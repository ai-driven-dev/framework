import { resolve } from "node:path";
import { FileHash } from "../../../../shared/domain/file-hash.js";
import { tryParseJson } from "../../../../shared/domain/reading/json-file.js";
import { asPlainObject } from "../../../../shared/domain/reading/plain-object.js";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { Manifest } from "../../domain/manifest.js";

/** A shared settings file a tool's entry in the manifest tracks. */
export interface TrackedSettingsFile {
  readonly projectRoot: string;
  readonly path: string;
  readonly manifest: Manifest;
  readonly toolId: ToolId;
}

/** What TrackedSharedSettings is built from. */
export interface TrackedSharedSettingsDeps {
  readonly fs: FileReader & FileWriter;
  readonly logger: Logger;
}

/** The project settings files a tool shares with its host, read and written with the manifest's
 * hash of each kept in step with what was written. */
export interface TrackedSharedSettings {
  read(projectRoot: string, path: string): Promise<Record<string, unknown>>;
  /** Like `read`, for a caller that writes nothing when the file holds no entry of its own, so a
   * malformed file is no rewrite worth a warning. */
  readQuietly(projectRoot: string, path: string): Promise<Record<string, unknown>>;
  write(file: TrackedSettingsFile, json: Record<string, unknown>): Promise<void>;
}

/** The parsed object, `{}` when the file is absent or holds no object, `null` when it is not
 * valid JSON. */
async function parseSettings(
  fs: FileReader,
  projectRoot: string,
  path: string
): Promise<Record<string, unknown> | null> {
  const absPath = resolve(projectRoot, path);
  if (!(await fs.fileExists(absPath))) return {};
  const parsed = tryParseJson(await fs.readFile(absPath));
  return parsed.ok ? (asPlainObject(parsed.value) ?? {}) : null;
}

// These files are co-owned and the machine-local one is untracked and gitignored, which is
// exactly the kind of file people hand-edit: a trailing comma must not take the whole sync
// down with it.
async function readSettings(
  { fs, logger }: TrackedSharedSettingsDeps,
  projectRoot: string,
  path: string
): Promise<Record<string, unknown>> {
  const settings = await parseSettings(fs, projectRoot, path);
  if (settings !== null) return settings;
  logger.warn(
    `Ignoring malformed JSON in ${resolve(projectRoot, path)}; rewriting the keys this CLI owns.`
  );
  return {};
}

async function readSettingsQuietly(
  { fs }: TrackedSharedSettingsDeps,
  projectRoot: string,
  path: string
): Promise<Record<string, unknown>> {
  return (await parseSettings(fs, projectRoot, path)) ?? {};
}

async function writeSettings(
  { fs }: TrackedSharedSettingsDeps,
  file: TrackedSettingsFile,
  json: Record<string, unknown>
): Promise<void> {
  const content = JSON.stringify(json, null, 2);
  await fs.writeFile(resolve(file.projectRoot, file.path), content);
  file.manifest.recordFileHash(file.toolId, file.path, FileHash.of(content));
}

export function trackedSharedSettings(deps: TrackedSharedSettingsDeps): TrackedSharedSettings {
  return {
    read: (projectRoot, path) => readSettings(deps, projectRoot, path),
    readQuietly: (projectRoot, path) => readSettingsQuietly(deps, projectRoot, path),
    write: (file, json) => writeSettings(deps, file, json),
  };
}

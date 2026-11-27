import { join } from "node:path";
import { describeError } from "../../../../shared/domain/describe-error.js";
import { hooksFilePath } from "../../../../shared/domain/materialization/artifact-path.js";
import { tryParseJson } from "../../../../shared/domain/reading/json-file.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import { FlatMergeTargetNotJsonError } from "../../contract/translate.error.js";
import { mergeFlatHooks } from "../../domain/flat-layout.js";
import type { FlatHooksStep } from "../../ports/flat-plugin-writer.js";

type FlatFiles = FileReader & FileWriter;

/** One plugin's hooks manifest, merged into the hooks file every plugin of the tool shares. The
 * scripts, the bridge and a hooks file one plugin owns are built by the engine, so a tool that
 * reads none, or gives each plugin its own, gets nothing here. */
export async function writeFlatHooks(
  fs: FlatFiles,
  logger: Logger,
  { target, artifact, pluginName, hooksJson, carriesRelease }: FlatHooksStep
): Promise<number> {
  const file = artifact.skipHooksJson ? undefined : artifact.hooksFile;
  if (file === undefined || !("shared" in file.at)) return 0;
  const shownPath = hooksFilePath(file, pluginName);
  const destPath = join(target.outDir, shownPath);
  const existing = await readSharedHooksTarget(fs, { destPath, shownPath });
  const { content, warnings } = mergeFlatHooks({ file, contract: target.contract }, existing, {
    json: hooksJson,
    plugin: pluginName,
    carriesRelease,
  });
  for (const w of warnings) logger.warn(w);
  await fs.writeFile(destPath, content);
  return 1;
}

async function readSharedHooksTarget(
  fs: FlatFiles,
  target: { destPath: string; shownPath: string }
): Promise<string | null> {
  if (!(await fs.fileExists(target.destPath))) return null;
  const content = await fs.readFile(target.destPath);
  const parsed = tryParseJson(content);
  if (!parsed.ok)
    throw new FlatMergeTargetNotJsonError(target.shownPath, describeError(parsed.error));
  return content;
}

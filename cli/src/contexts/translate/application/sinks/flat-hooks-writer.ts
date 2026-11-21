import { join, relative } from "node:path";
import { describeError } from "../../../../shared/domain/describe-error.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import { flatPathOfPluginSuffix } from "../../domain/flat-layout.js";
import { FlatMergeTargetNotJsonError } from "../../domain/translate.error.js";
import type { FlatHooksStep } from "../../ports/flat-plugin-writer.js";
import { assertFlatDestinationFree } from "./flat-collision.js";

type FlatFiles = FileReader & FileWriter;

/** One plugin's hooks file, merged into the tool's own. The scripts and the bridge are built by
 * the engine. A tool that reads no hooks file gets nothing here. */
export async function writeFlatHooks(
  fs: FlatFiles,
  logger: Logger,
  { target, artifact, pluginName, hooksSrc }: FlatHooksStep
): Promise<number> {
  const file = artifact.skipHooksJson ? undefined : artifact.hooksFile;
  if (file === undefined) return 0;
  const destPath = join(target.outDir, file.path(pluginName));
  if (!file.shared) await assertFlatDestinationFree(fs, { target, destPath, pluginName });
  const existing = file.shared ? await readSharedHooksTarget(fs, target.outDir, destPath) : null;
  const raw = await fs.readFile(hooksSrc);
  const { content, warnings } = file.merge(existing, {
    json: raw,
    plugin: pluginName,
    locate: (pluginPath) => `./${flatPathOfPluginSuffix(target.contract, pluginPath, pluginName)}`,
  });
  for (const w of warnings) logger.warn(w);
  await fs.writeFile(destPath, content);
  return 1;
}

async function readSharedHooksTarget(
  fs: FlatFiles,
  outDir: string,
  destPath: string
): Promise<string | null> {
  if (!(await fs.fileExists(destPath))) return null;
  const content = await fs.readFile(destPath);
  assertParsableJson(content, outDir, destPath);
  return content;
}

function assertParsableJson(content: string, outDir: string, destPath: string): void {
  try {
    JSON.parse(content);
  } catch (err) {
    const shown = relative(outDir, destPath).replace(/\\/g, "/");
    throw new FlatMergeTargetNotJsonError(shown, describeError(err));
  }
}

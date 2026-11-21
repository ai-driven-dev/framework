import { join, relative } from "node:path";
import { describeError } from "../../../../shared/domain/describe-error.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import { mergeFlatHooks } from "../../domain/flat-layout.js";
import { FlatMergeTargetNotJsonError } from "../../domain/translate.error.js";
import type { FlatHooksStep } from "../../ports/flat-plugin-writer.js";

type FlatFiles = FileReader & FileWriter;

/** One plugin's hooks manifest, merged into the hooks file every plugin of the tool shares. The
 * scripts, the bridge and a hooks file one plugin owns are built by the engine, so a tool that
 * reads none, or gives each plugin its own, gets nothing here. */
export async function writeFlatHooks(
  fs: FlatFiles,
  logger: Logger,
  { target, artifact, pluginName, hooksJson }: FlatHooksStep
): Promise<number> {
  const file = artifact.skipHooksJson ? undefined : artifact.hooksFile;
  if (file === undefined || !file.shared) return 0;
  const destPath = join(target.outDir, file.path(pluginName));
  const existing = await readSharedHooksTarget(fs, target.outDir, destPath);
  const { content, warnings } = mergeFlatHooks({ file, contract: target.contract }, existing, {
    json: hooksJson,
    plugin: pluginName,
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

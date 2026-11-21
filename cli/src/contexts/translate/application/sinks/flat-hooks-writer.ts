import { dirname, join, relative } from "node:path";
import { describeError } from "../../../../shared/domain/describe-error.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import { flatHooksBridgeFile, flatPathOfPluginSuffix } from "../../domain/flat-layout.js";
import { FlatMergeTargetNotJsonError } from "../../domain/translate.error.js";
import type { FlatHooksStep } from "../../ports/flat-plugin-writer.js";
import { assertFlatDestinationFree } from "./flat-collision.js";

type FlatFiles = FileReader & FileWriter;

/** One plugin's flat hooks: the hooks file or the bridge, then the scripts it points at. */
export async function writeFlatHooks(
  fs: FlatFiles,
  logger: Logger,
  step: FlatHooksStep
): Promise<number> {
  const jsonCount = step.artifact.skipHooksJson
    ? await writeHooksBridgeIfDeclared(fs, step)
    : await writeFlatHooksJson(fs, logger, step);
  return jsonCount + (await writeFlatHooksScripts(fs, step));
}

async function writeFlatHooksJson(
  fs: FlatFiles,
  logger: Logger,
  { target, artifact, pluginName, hooksSrc }: FlatHooksStep
): Promise<number> {
  const file = artifact.hooksFile;
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

// OpenCode reads no hooks.json, so a plugin's declared hooks have no trigger there unless a
// generated bridge replaces the manifest a native host would read. Raw content only: the
// bridge resolves its own scripts from its own `import.meta.url`, never from an outDir-relative
// path this sink would otherwise rewrite for it.
async function writeHooksBridgeIfDeclared(
  fs: FlatFiles,
  { target, artifact, pluginName, hooksSrc }: FlatHooksStep
): Promise<number> {
  const bridge = artifact.hooksBridge;
  if (!bridge) return 0;
  const shipsItsOwn = await fs.fileExists(join(dirname(hooksSrc), bridge.skipIfSourceHas));
  const generated = flatHooksBridgeFile({
    bridge,
    rawHooksJson: await fs.readFile(hooksSrc),
    pluginName,
    sourceShipsItsOwn: shipsItsOwn,
  });
  if (generated === null) return 0;
  const destPath = join(target.outDir, generated.relativePath);
  await assertFlatDestinationFree(fs, { target, destPath, pluginName });
  await fs.writeFile(destPath, generated.content);
  return 1;
}

async function writeFlatHooksScripts(
  fs: FlatFiles,
  { target, artifact, pluginName, pluginSrc }: FlatHooksStep
): Promise<number> {
  const hooksDir = join(pluginSrc, "hooks");
  let count = 0;
  for (const absPath of await fs.listFilesRecursive(hooksDir)) {
    if (absPath.endsWith("hooks.json")) continue;
    const pluginPath = `hooks/${relative(hooksDir, absPath).replace(/\\/g, "/")}`;
    const destPath = join(target.outDir, artifact.path(pluginName, pluginPath));
    await assertFlatDestinationFree(fs, { target, destPath, pluginName });
    const content = await fs.readFile(absPath);
    await fs.writeFile(destPath, artifact.script?.(pluginPath, content) ?? content);
    count++;
  }
  return count;
}

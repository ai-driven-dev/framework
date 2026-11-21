import { basename, join, relative } from "node:path";
import { parseFrontmatter, serializeFrontmatter } from "../../../../shared/domain/markdown.js";
import { rewriteRelativeLinks } from "../../../../shared/domain/materialization/relative-link-rewrite.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import { flatAgentPath, flatLinkTarget } from "../../domain/flat-layout.js";
import { assertNoToolsPlaceholder } from "../../domain/tools-placeholder.js";
import type { FlatFileStep, FlatTarget } from "../../ports/flat-plugin-writer.js";
import { assertFlatDestinationFree } from "./flat-collision.js";

type FlatFiles = FileReader & FileWriter;

/** One agent of a plugin, written where the flat layout puts it. */
export async function writeFlatAgent(
  fs: FlatFiles,
  { target, artifact, pluginName, absPath, srcRoot }: FlatFileStep
): Promise<number> {
  const agentBaseName = basename(absPath);
  const srcRelPath = `agents/${relative(srcRoot, absPath).replace(/\\/g, "/")}`;
  const content = await fs.readFile(absPath);
  assertNoToolsPlaceholder(content, pluginName, srcRelPath);
  const flatRelPath = flatAgentPath(artifact, pluginName, agentBaseName);
  const destPath = join(target.outDir, flatRelPath);
  await assertFlatDestinationFree(fs, { target, destPath, pluginName });
  const outContent = artifact.transform
    ? artifact.transform(content, pluginName, agentBaseName)
    : rewriteAgentLinks(target, { content, flatRelPath, pluginName });
  await fs.writeFile(destPath, outContent);
  return 1;
}

function rewriteFlatLinks(
  target: FlatTarget,
  { content, flatRelPath, pluginName }: { content: string; flatRelPath: string; pluginName: string }
): string {
  return rewriteRelativeLinks(content, {
    currentFilePluginRelative: flatRelPath,
    resolveTargetPath: (rel) => flatLinkTarget(target.contract, pluginName, rel),
  });
}

function rewriteAgentLinks(
  target: FlatTarget,
  step: { content: string; flatRelPath: string; pluginName: string }
): string {
  const { frontmatter, body } = parseFrontmatter(step.content);
  return serializeFrontmatter(frontmatter, rewriteFlatLinks(target, { ...step, content: body }));
}

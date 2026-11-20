import { basename, join, relative } from "node:path";
import { rewriteRelativeLinks } from "../../../../shared/domain/materialization/relative-link-rewrite.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import { PLUGIN_SKILL_ENTRY_FILE } from "../../domain/canon-format.js";
import { assertNoToolsPlaceholder } from "../shared-plugin-helpers.js";

type SkillContentTransform = (content: string, plugin: string, basename: string) => string;

interface SkillTree {
  readonly fs: FileReader & FileWriter;
  readonly pluginName: string;
  readonly pluginSrc: string;
  readonly pluginOut: string;
  readonly transform?: SkillContentTransform;
}

export async function writeSkillTree(tree: SkillTree): Promise<number> {
  const skillsSrc = join(tree.pluginSrc, "skills");
  const files = await tree.fs.listFilesRecursive(skillsSrc);
  let count = 0;
  for (const absPath of files) {
    count += await writeSkillFile({ ...tree, absPath, skillsSrc });
  }
  return count;
}

async function writeSkillFile({
  fs,
  pluginName,
  absPath,
  skillsSrc,
  pluginOut,
  transform,
}: SkillTree & { absPath: string; skillsSrc: string }): Promise<number> {
  const relPath = relative(skillsSrc, absPath).replace(/\\/g, "/");
  const destPath = join(pluginOut, "skills", relPath);
  const content = await fs.readFile(absPath);
  if (absPath.endsWith(".md")) {
    assertNoToolsPlaceholder(content, pluginName, relPath);
    const currentFilePluginRelative = `skills/${relPath}`;
    const rewritten = rewriteRelativeLinks(content, { currentFilePluginRelative });
    const isEntry = transform !== undefined && basename(absPath) === PLUGIN_SKILL_ENTRY_FILE;
    await fs.writeFile(
      destPath,
      isEntry ? transform(rewritten, pluginName, PLUGIN_SKILL_ENTRY_FILE) : rewritten
    );
  } else {
    await fs.writeFile(destPath, content);
  }
  return 1;
}

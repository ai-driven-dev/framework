import { join } from "node:path";
import { whenAbsent } from "../../../../../shared/domain/reading/json-file.js";
import type { FileReader } from "../../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../../shared/ports/file-writer.js";
import type { RulesIndexAnswers } from "../../../../tools/contract/tool-profile.js";
import type { AddPluginRequest } from "../add-plugin-request.js";

/** Lists `glob` in the guidance file at `path`, after what a person wrote there. Refuses a file
 * whose block a person broke, and leaves it as it was. */
export async function listRulesIn(
  fs: FileReader & FileWriter,
  path: string,
  { index, glob }: { readonly index: RulesIndexAnswers; readonly glob: string }
): Promise<void> {
  const existing = await whenAbsent(() => fs.readFile(path), null);
  const content = index.withGlob(existing, glob);
  if (content !== existing) await fs.writeFile(path, content);
}

/** Takes `glob` out of the guidance file at `path`, the file going when nothing else was in it. */
export async function unlistRulesIn(
  fs: FileReader & FileWriter,
  path: string,
  { index, glob }: { readonly index: RulesIndexAnswers; readonly glob: string }
): Promise<void> {
  const existing = await whenAbsent(() => fs.readFile(path), undefined);
  if (existing === undefined) return;
  const content = index.withoutGlob(existing, glob);
  if (content === existing) return;
  if (content === "") await fs.deleteFile(path);
  else await fs.writeFile(path, content);
}

/** Lists the plugin's rules glob in the file a tool reads its guidance from, for a tool with no
 * rules folder of its own; nothing for a plugin that placed no rule. Refuses a file whose block a
 * person broke, before the plugin's files are written. */
export async function listPlacedRules(
  fs: FileReader & FileWriter,
  { tool, projectRoot }: Pick<AddPluginRequest, "tool" | "projectRoot">,
  rulesGlob: string | null
): Promise<void> {
  const index = tool.rulesIndex();
  if (index === null || rulesGlob === null) return;
  await listRulesIn(fs, join(projectRoot, index.relativePath), { index, glob: rulesGlob });
}

/** Brings the guidance file in line with the plugin's placed `files`: the rules glob is listed
 * when they hold a rule, taken out when they hold none. Refuses a broken block before any file is
 * written. Returns the rules among `files`. */
export async function syncRulesListing<F extends { readonly relativePath: string }>(
  fs: FileReader & FileWriter,
  at: { readonly index: RulesIndexAnswers; readonly projectRoot: string },
  placed: { readonly plugin: string; readonly files: readonly F[] }
): Promise<F[]> {
  const { index, projectRoot } = at;
  const glob = index.globOf(placed.plugin);
  if (glob === null) return [];
  const rules = placed.files.filter(
    (file) => index.globIn(placed.plugin, [file.relativePath]) !== null
  );
  const path = join(projectRoot, index.relativePath);
  if (rules.length === 0) await unlistRulesIn(fs, path, { index, glob });
  else await listRulesIn(fs, path, { index, glob });
  return rules;
}

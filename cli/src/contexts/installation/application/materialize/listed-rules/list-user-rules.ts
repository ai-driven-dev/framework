import { join, relative, sep } from "node:path";
import { whenAbsent } from "../../../../../shared/domain/reading/json-file.js";
import type { FileReader } from "../../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../../shared/ports/file-writer.js";
// biome-ignore lint/plugin: hands the profile to the plugin translation pipeline; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../../tools/contract/tool-profile.js";
import { listRulesIn, unlistRulesIn } from "./list-placed-rules.js";

/** What a machine-scope plugin holds under the tool's user directory, `baseDir`. */
export interface UserRules {
  readonly tool: AiToolProfile;
  readonly baseDir: string;
  readonly home: string;
  readonly plugin: string;
  /** The plugin's files by path below `baseDir`. */
  readonly files: readonly { readonly relativePath: string }[];
}

/** The listing the plugin's rules take in the user's own guidance file, `null` for a tool that
 * keeps none or a plugin with no rule. A file is told by the path it has in a project, the tool's
 * directory below the project root, which is the user directory below the home; the glob names
 * them from the home, where no project root is. */
function listingOf({ tool, baseDir, home, plugin, files }: UserRules) {
  const index = tool.rulesIndex();
  const glob = index?.globOf(plugin) ?? null;
  if (index === null || glob === null) return null;
  const placed = files.map((file) => `${tool.directory}${file.relativePath}`);
  const fromHome = relative(home, baseDir).split(sep).join("/");
  const named = `~/${fromHome}/${glob.slice(tool.directory.length)}`;
  const path = join(baseDir, index.relativePath);
  return { index, path, glob: named, listed: index.globIn(plugin, placed) !== null };
}

/** Refuses, before any file is written, a user guidance file whose block a person broke. */
export async function assertUserRulesListable(fs: FileReader, rules: UserRules): Promise<void> {
  const listing = listingOf(rules);
  if (listing === null || !listing.listed) return;
  listing.index.withGlob(await whenAbsent(() => fs.readFile(listing.path), null), listing.glob);
}

/** Lists the plugin's rules in the user's guidance file when it holds any, and takes the listing
 * out when it holds none. */
export async function syncUserRules(fs: FileReader & FileWriter, rules: UserRules): Promise<void> {
  const listing = listingOf(rules);
  if (listing === null) return;
  const { index, path, glob } = listing;
  if (listing.listed) await listRulesIn(fs, path, { index, glob });
  else await unlistRulesIn(fs, path, { index, glob });
}

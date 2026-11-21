import { join, posix } from "node:path";
import { FileHash } from "../../../../shared/domain/file-hash.js";
import { InstallationFile } from "../../../../shared/domain/installation-file.js";
import { posixRelative } from "../../../../shared/domain/paths.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
// biome-ignore lint/plugin: hands the profile to the built-tree ownership check; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";

/** Where a built tree lives and how its paths are spelled. */
export interface BuiltTreeLocation {
  builtDir: string;
  platform: string;
}

/** What picks a plugin's files out of a flat build. */
export interface FlatBuildSelection {
  name: string;
  tool: AiToolProfile;
  /** Files the plugin owns that the tool's path rules do not recognise, such as its hooks. */
  extraPaths: ReadonlySet<string>;
}

// Flat build emits the whole marketplace into one workspace. Agents are namespaced by
// `<plugin>-<name>`; skills keep their subtree intact, since a skill's script can `require()` a
// sibling by relative path, under `skills/<plugin>/` or, `single-level`, `skills/<plugin>-<skill>/`.
// Hooks land under `flatHooksDir/<plugin>/`, except the loader's own runtime module, renamed to
// the plugin's name in the loader's directory: so hook paths are matched by path, not by name.
export async function readBuiltFlatFiles(
  fs: FileReader,
  built: BuiltTreeLocation,
  selection: FlatBuildSelection
): Promise<InstallationFile[]> {
  const { builtDir, platform } = built;
  const { name, tool, extraPaths } = selection;
  const files: InstallationFile[] = [];
  for (const abs of await fs.listFilesRecursive(builtDir)) {
    const rel = posixRelative(builtDir, abs, platform);
    if (!tool.ownsFlatPath(rel, name) && !extraPaths.has(rel)) continue;
    const content = await fs.readFile(abs);
    files.push(new InstallationFile({ relativePath: rel, content, hash: FileHash.of(content) }));
  }
  return files;
}

export async function readBuiltUserPluginFiles(
  fs: FileReader,
  built: { builtDir: string; name: string; platform: string }
): Promise<InstallationFile[]> {
  const { builtDir, name, platform } = built;
  const pluginSrc = join(builtDir, "plugins", name);
  const absPaths = await fs.listFilesRecursive(pluginSrc);
  return Promise.all(
    absPaths.map(async (abs) => {
      const rel = posixRelative(pluginSrc, abs, platform);
      const content = await fs.readFile(abs);
      return new InstallationFile({
        relativePath: posix.join(name, rel),
        content,
        hash: FileHash.of(content),
      });
    })
  );
}

// `readBuiltUserPluginFiles` prefixes every path with `<name>/`, so a built-tree hooks file always
// reads `<name>/hooks/<rest>`.
export function withoutHooksPrefix(
  files: InstallationFile[],
  pluginName: string
): InstallationFile[] {
  const hooksPrefix = `${pluginName}/hooks/`;
  return files.filter((f) => !f.relativePath.startsWith(hooksPrefix));
}

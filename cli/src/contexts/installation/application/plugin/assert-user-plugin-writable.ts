import { join } from "node:path";
import type { InstallationFile } from "../../../../shared/domain/installation-file.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
// biome-ignore lint/plugin: hands the profile to the plugin translation pipeline; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";
import { type InstalledPlugin, PLUGIN_NAME_REGEX } from "../../domain/plugins/installed-plugin.js";
import type {
  ContainmentCheck,
  UserScopeFileGuard,
} from "../../ports/plugin/user-plugin-materialization.js";
import { assertGlobalFilesWritable } from "./global-plugin-files.js";
import { scopeBaseOf } from "./plugin-target-resolution.js";

/** What proves a machine-scope write stays inside the user directory. */
export interface UserWriteProof {
  readonly fs: FileReader & FileWriter;
  readonly guard: UserScopeFileGuard;
}

/** The files one machine-scope plugin update is about to write. */
export interface UserPluginWrite {
  readonly plugin: InstalledPlugin;
  readonly tool: AiToolProfile;
  readonly files: readonly InstallationFile[];
  readonly home: string;
  readonly isWithinUserScope: ContainmentCheck;
}

/** A tool's global files spread across its user directory; a user-scope plugin directory
 * holds one plugin per subdirectory. Each layout has its own containment proof. */
export async function assertUserPluginWritable(
  proof: UserWriteProof,
  write: UserPluginWrite
): Promise<void> {
  const { plugin, tool, files, home, isWithinUserScope } = write;
  if (tool.plugins()?.globalFiles() != null) {
    await assertGlobalFilesWritable({
      fs: proof.fs,
      tool,
      plugin,
      pluginName: plugin.name,
      files,
      homedir: home,
      isWithinUserScope,
    });
    return;
  }
  const baseDir = scopeBaseOf(tool, { scope: "user", projectRoot: "", homedir: () => home });
  // A first install owns no file yet, and a restore may have lost the directory: it is created
  // so the containment proof has a real path to resolve. The name is one safe path segment.
  if (PLUGIN_NAME_REGEX.test(plugin.name)) {
    await proof.fs.createDirectory(join(baseDir, plugin.name));
  }
  await proof.guard.assertWriteBoundary({ fs: proof.fs, home }, tool, {
    pluginName: plugin.name,
    files: [...files],
  });
  await assertNewFilesDoNotCollide(proof.fs, { plugin, tool, baseDir, files });
}

async function assertNewFilesDoNotCollide(
  fs: FileReader,
  write: {
    readonly plugin: InstalledPlugin;
    readonly tool: AiToolProfile;
    readonly baseDir: string;
    readonly files: readonly InstallationFile[];
  }
): Promise<void> {
  const { plugin, tool, baseDir, files } = write;
  for (const file of files) {
    if (plugin.files.has(file.relativePath)) continue;
    if (!(await fs.fileExists(join(baseDir, file.relativePath)))) continue;
    throw new Error(
      `${tool.toolId}: '${plugin.name}' has untracked existing file '${file.relativePath}'; update refused without overwriting user content or changing its machine claim.`
    );
  }
}

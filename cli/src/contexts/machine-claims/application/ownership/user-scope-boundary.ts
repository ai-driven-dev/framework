import type { InstallationFile } from "../../../../shared/domain/installation-file.js";
import { whenAbsent } from "../../../../shared/domain/reading/json-file.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { UserScopeTool } from "../../ports/user-scope-tool.js";

/** The disk a machine-scope plugin is judged on, and the home its user plugins directory sits under. */
export interface UserScopeReach {
  readonly fs: FileReader;
  readonly home: string;
}

/** A reach that also says why a file is left in place. */
export interface ReportingUserScopeReach extends UserScopeReach {
  readonly logger: Logger;
}

/** The files an update is about to write into one plugin's directory. */
export interface UserScopeWrite {
  readonly pluginName: string;
  readonly files: readonly InstallationFile[];
}

export function userPluginsBoundary(tool: UserScopeTool, home: string): string | null {
  return tool.plugins()?.userPluginsBaseDir(home) ?? null;
}

export async function tryRealpath(fs: FileReader, path: string): Promise<string | null> {
  return whenAbsent(() => fs.realpath(path), null);
}

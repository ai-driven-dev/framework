import type { InstallationFile } from "../../../../shared/domain/file.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { Logger } from "../../../../shared/ports/logger.js";
// biome-ignore lint/plugin: hands the profile to the plugin translation pipeline; it narrows when installation declares its own profile input
import type { AiToolProfile } from "../../../tools/contract/tool-profile.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";

/**
 * Whether a resolved path sits strictly inside a resolved boundary. Composition supplies the
 * machine-claims rule, so installation never reaches into that context.
 */
export type ContainmentCheck = (resolvedCandidate: string, resolvedBoundary: string) => boolean;

export interface PlannedUserPluginFileUpdate {
  readonly plugin: InstalledPlugin;
  readonly tool: AiToolProfile;
  readonly home: string;
  readonly baseDir: string;
  readonly files: readonly InstallationFile[];
  readonly oldSafe: ReadonlyMap<string, string>;
  readonly next: InstalledPlugin;
}

/** The machine-scope file safety checks, supplied by the composition root so installation never reaches machine claims. */
export interface UserScopeFileGuard {
  safeToDelete(
    reach: { readonly fs: FileReader; readonly logger: Logger; readonly home: string },
    plugin: InstalledPlugin,
    tool: AiToolProfile
  ): Promise<ReadonlyMap<string, string>>;
  withoutMissing(
    reach: { readonly fs: FileReader; readonly home: string },
    plugin: InstalledPlugin,
    tool: AiToolProfile
  ): Promise<InstalledPlugin>;
  assertWriteBoundary(
    reach: { readonly fs: FileReader; readonly home: string },
    tool: AiToolProfile,
    write: { readonly pluginName: string; readonly files: readonly InstallationFile[] }
  ): Promise<void>;
}

/** What a machine-scope plugin update works on. */
export interface UserPluginUpdateRequest {
  readonly plugin: InstalledPlugin;
  readonly tool: AiToolProfile;
  readonly projectRoot: string;
  readonly logger: Logger;
  readonly isWithinUserScope: ContainmentCheck;
}

/** The file half of a machine-scope plugin update: planned and proven first, applied after. The
 * containment rule a write must satisfy arrives with each call, from the scenario that owns it. */
export interface UserPluginMaterialization {
  update(request: UserPluginUpdateRequest): Promise<InstalledPlugin | null>;
  planUpdate(
    request: UserPluginUpdateRequest & { readonly rebuild: boolean }
  ): Promise<PlannedUserPluginFileUpdate | null>;
  applyUpdate(
    plan: PlannedUserPluginFileUpdate,
    request: Pick<UserPluginUpdateRequest, "logger" | "isWithinUserScope">
  ): Promise<InstalledPlugin>;
}

/** The same two steps with the containment rule already bound, for a caller that is not a scenario. */
export interface BoundPluginMaterializer {
  planUpdate(
    request: Omit<UserPluginUpdateRequest, "isWithinUserScope" | "rebuild"> & {
      readonly rebuild?: boolean;
    }
  ): Promise<PlannedUserPluginFileUpdate | null>;
  applyUpdate(plan: PlannedUserPluginFileUpdate, logger: Logger): Promise<InstalledPlugin>;
}

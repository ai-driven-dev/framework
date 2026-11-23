import type { Scope } from "../../../../shared/domain/scope.js";
import type { AiToolId, ToolId } from "../../../../shared/domain/tool.js";
import type { ScopeRecords, ToolRecord } from "../../contract/records/scope-records.js";
import type { NativeHostTool } from "../../ports/tool-sections.js";

/** What a clean announces of one tool's recorded registration. */
export interface RegistrationPreview {
  readonly binary: string;
  readonly marketplaceCount: number;
  readonly pluginRefCount: number;
  readonly cachePaths: readonly string[];
}

/** A tool's recorded registration the project clean withdraws from its host. */
export interface ProjectRegistrationWithdrawal {
  readonly tool: NativeHostTool;
  readonly registrations: ToolRecord;
  readonly cacheRoot: string | undefined;
  /** The scope the manifest recorded for each plugin ref, by ref. */
  readonly refScopes: ReadonlyMap<string, Scope>;
}

/** What a clean plan asks of the host registration about each record the project kept. */
export interface ProjectCleanRecords extends Pick<ScopeRecords, "loadRecords"> {
  /** The refs recorded on the host, none when nothing was recorded. */
  pluginRefsOf(registrations: ToolRecord | undefined): readonly string[];
  /** The ref a plugin has on the host, `undefined` when nothing was recorded for the alias. */
  refOf(registrations: ToolRecord, plugin: string, alias: string | undefined): string | undefined;
  /** What a clean announces of the record, with the cache paths it would purge under the root. */
  registrationPreview(
    registrations: ToolRecord,
    cacheRoot: string | undefined
  ): RegistrationPreview;
}

/** `cachePaths` are the absolute paths a `--force` run will attempt to purge: empty for a tool
 * whose profile declares no `NativeActivation.pluginCacheDir`. An announcement, not a guarantee:
 * whether a path is still there, and safe to purge, is known only once the host's CLI ran. */
export type CleanNativeRegistrationPreview = RegistrationPreview & { readonly toolId: ToolId };

/** What a project clean would do, read before anything is touched. */
export interface ProjectCleanPlan {
  tools: Array<{ toolId: ToolId; fileCount: number }>;
  totalFileCount: number;
  /** What a `--force` run will ask each tool's own CLI to undo: that step drives an external
   * binary, the one part of `clean` a file count cannot express. */
  nativeRegistrations: CleanNativeRegistrationPreview[];
  /** The AI tools whose host holds registrations this project made. A non-AI tool never does;
   * were one recorded, it is left out rather than guessed at. */
  withdrawals: ProjectRegistrationWithdrawal[];
  /** The native plugin refs this project recorded, by tool. */
  nativeRefs: ReadonlyMap<ToolId, readonly string[]>;
  /** The plugins installed at user scope, whose machine claim this project releases. */
  userPlugins: Array<{ toolId: AiToolId; name: string }>;
}

import type { FrameworkBuildMode } from "../../tools/contract/tool-profile.js";
import type { FrameworkBuildOptions, FrameworkBuildResult } from "./build-targets.js";

/** Running one framework build, as its callers need it. */
export interface FrameworkBuild {
  execute(options: FrameworkBuildOptions): Promise<FrameworkBuildResult>;
}

/** What a build for a target and mode asks of its caller. */
export interface FrameworkBuildContext {
  readonly target: string;
  readonly mode: FrameworkBuildMode;
  readonly outDir: string;
  readonly force: boolean;
  /** The provider whose models the framework's agents run on; absent, each keeps the IDE's. */
  readonly provider?: string;
}

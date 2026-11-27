import type { FrameworkSource } from "../../contexts/distribution/contract/framework-source.js";
import type { NativeActivationReport } from "../../contexts/installation/application/install/install-ai-tool.use-case.js";
import type { InstallToolsResult } from "../../contexts/installation/application/install/install-tools.use-case.js";
import type { ProjectContext } from "../../contexts/installation/contract/project-context.js";
import type { SetupFlow } from "./setup-flow.model.js";

/** Records the project's claim on the shared framework source. */
export type ClaimFrameworkSource = () => Promise<void>;

/** Registers the chosen framework source for a setup, and hands back the project's claim on it when
 * it has one. The registration sequence is not the setup's own: composition hands it in. */
export type RegisterFrameworkSource = (
  flow: Pick<SetupFlow, "projectRoot" | "scope">,
  source: FrameworkSource | null
) => Promise<ClaimFrameworkSource | undefined>;

/** What a setup did: `initialized` when this run created the manifest it works on, `up-to-date`
 * when one was already there. */
export interface SetupResult {
  readonly kind: "initialized" | "up-to-date";
  readonly install: InstallToolsResult;
  readonly activation: NativeActivationReport;
  readonly context?: ProjectContext;
  /** Set by a global run: the plugins it installed for every project. */
  readonly globalPlugins?: readonly string[];
}

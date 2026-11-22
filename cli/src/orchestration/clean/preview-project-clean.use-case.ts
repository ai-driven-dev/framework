import type { ListMarketplaces } from "../../contexts/distribution/application/list-marketplaces.use-case.js";
import type { RegistrationRecordRules } from "../../contexts/host-registration/contract/registration-record-rules.js";
import type { CleanProjectFiles } from "../../contexts/installation/application/clean/clean-project-files.use-case.js";
import type {
  CleanNativeRegistrationPreview,
  ProjectCleanPlan,
} from "../../contexts/installation/application/clean/project-clean-plan.js";
import type { ToolId } from "../../shared/domain/tool.js";
import type { CleanClaims } from "./clean-claims.js";

export interface PreviewProjectCleanRequest {
  projectRoot: string;
}

export interface CleanPreview {
  tools: Array<{ toolId: ToolId; fileCount: number }>;
  totalFileCount: number;
  nativeRegistrations: CleanNativeRegistrationPreview[];
  /** The *other* projects on this machine that reference the shared source, read before
   * `--force` would drop this project's own claim, never after. `undefined` when the port was
   * never wired in, or no shared, machine-scope marketplace is registered locally. */
  sharedSourceOtherProjects?: readonly string[];
}

export interface PreviewProjectCleanResult {
  plan: ProjectCleanPlan;
  preview: CleanPreview;
}

export interface PreviewProjectCleanDeps {
  readonly cleanProject: Pick<CleanProjectFiles, "execute">;
  readonly claims: Pick<CleanClaims, "sharedClaim">;
  readonly marketplaces: Pick<ListMarketplaces, "execute">;
  readonly records: Pick<RegistrationRecordRules, "pluginRefsOf" | "refOf" | "registrationPreview">;
}

/** What `aidd clean` would remove from a project: its plan and what the person is shown of it.
 * `null` when the project has no manifest. */
export class PreviewProjectClean {
  constructor(private readonly deps: PreviewProjectCleanDeps) {}

  async execute(request: PreviewProjectCleanRequest): Promise<PreviewProjectCleanResult | null> {
    const { projectRoot } = request;
    const plan = await this.deps.cleanProject.execute({
      kind: "plan",
      records: this.deps.records,
    });
    if (plan === null) return null;
    const shared = await this.deps.claims.sharedClaim({
      projectRoot,
      list: async () => (await this.deps.marketplaces.execute({ projectRoot })).marketplaces,
    });
    return {
      plan,
      preview: {
        tools: plan.tools,
        totalFileCount: plan.totalFileCount,
        nativeRegistrations: plan.nativeRegistrations,
        sharedSourceOtherProjects: shared?.otherProjects,
      },
    };
  }
}

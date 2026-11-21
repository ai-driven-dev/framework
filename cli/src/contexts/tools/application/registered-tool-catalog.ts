import { UnregisteredToolError } from "../../../shared/domain/shared.error.js";
import type { AiToolId, IdeToolId, ToolCategory, ToolId } from "../../../shared/domain/tool.js";
import type { RecommendationContext, ToolCatalog } from "../contract/tool-catalog.js";
import type { AiToolProfile, IdeToolProfile, ToolProfile } from "../contract/tool-profile.js";
import { agentProviders } from "../domain/models/agent-models.js";
import type { BuiltToolConfig } from "../domain/profile/define-tool.js";
import { DuplicateToolIdError } from "../domain/tools.error.js";

/** The catalog of the profiles it is built from, which are held in the order they were given: the
 * canonical order. The help order is the same list with the tools delivering a native plugin first. */
export class RegisteredToolCatalog implements ToolCatalog {
  readonly #byId = new Map<string, BuiltToolConfig>();

  constructor(profiles: readonly BuiltToolConfig[]) {
    for (const profile of profiles) {
      if (this.#byId.has(profile.toolId)) throw new DuplicateToolIdError(profile.toolId);
      this.#byId.set(profile.toolId, profile);
    }
  }

  toolId(raw: string): ToolId | null {
    return this.#byId.get(raw)?.toolId ?? null;
  }

  aiToolId(raw: string): AiToolId | null {
    const profile = this.#byId.get(raw);
    return profile?.kind === "ai" ? profile.toolId : null;
  }

  isAiTool(id: ToolId): id is AiToolId;
  isAiTool(raw: string): boolean;
  isAiTool(raw: string): boolean {
    return this.#byId.get(raw)?.kind === "ai";
  }

  isIdeTool(id: ToolId): id is IdeToolId;
  isIdeTool(raw: string): boolean;
  isIdeTool(raw: string): boolean {
    return this.#byId.get(raw)?.kind === "ide";
  }

  profile(id: string): ToolProfile {
    const profile = this.#byId.get(id);
    if (profile === undefined) throw new UnregisteredToolError(id);
    return profile;
  }

  aiProfile(id: AiToolId): AiToolProfile {
    const profile = this.profile(id);
    if (profile.kind !== "ai") throw new UnregisteredToolError(id);
    return profile;
  }

  ideProfile(id: IdeToolId): IdeToolProfile {
    const profile = this.profile(id);
    if (profile.kind !== "ide") throw new UnregisteredToolError(id);
    return profile;
  }

  aiProfileIfAny(id: ToolId): AiToolProfile | null {
    const profile = this.profile(id);
    return profile.kind === "ai" ? profile : null;
  }

  inHelpOrder(category: "ai"): readonly AiToolId[];
  inHelpOrder(category: ToolCategory): readonly ToolId[];
  inHelpOrder(category: ToolCategory): readonly ToolId[] {
    const profiles = [...this.#byId.values()];
    const native = profiles.filter(
      (profile) => profile.kind === "ai" && profile.plugins()?.kind === "native"
    );
    return idsOf([...native, ...profiles.filter((profile) => !native.includes(profile))], category);
  }

  idsInCanonicalOrder(category: "ai"): readonly AiToolId[];
  idsInCanonicalOrder(category: "ide"): readonly IdeToolId[];
  idsInCanonicalOrder(category?: ToolCategory): readonly ToolId[];
  idsInCanonicalOrder(category?: ToolCategory): readonly ToolId[] {
    return idsOf([...this.#byId.values()], category);
  }

  sortedIds(): readonly ToolId[] {
    return [...this.#byId.values()].map((profile) => profile.toolId).sort();
  }

  agentProviders(): readonly string[] {
    const run = new Set(
      this.idsInCanonicalOrder("ai").flatMap(
        (id) => this.aiProfile(id).agentModels()?.providers() ?? []
      )
    );
    return agentProviders().filter((provider) => run.has(provider));
  }

  recommended(category: "ai", project?: RecommendationContext): readonly AiToolId[];
  recommended(category: "ide", project?: RecommendationContext): readonly IdeToolId[];
  recommended(category: ToolCategory, project?: RecommendationContext): readonly ToolId[] {
    if (project?.hasFramework === true) return [];
    const recommended = [...this.#byId.values()].filter(
      (profile) => profile.recommendedFor?.(project) === true
    );
    return idsOf(recommended, category);
  }
}

function idsOf(profiles: readonly BuiltToolConfig[], category?: ToolCategory): ToolId[] {
  return profiles
    .filter((profile) => category === undefined || profile.kind === category)
    .map((profile) => profile.toolId);
}

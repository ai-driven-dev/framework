import {
  DuplicateToolIdError,
  ToolOrderMismatchError,
  UnregisteredToolError,
} from "../../../shared/domain/errors.js";
import type { AiToolId, IdeToolId, ToolCategory, ToolId } from "../../../shared/domain/tool.js";
import type { ToolCatalog } from "../contract/tool-catalog.js";
import type { AiToolProfile, IdeToolProfile, ToolProfile } from "../contract/tool-profile.js";
import type { BuiltToolConfig } from "../domain/profile/define-tool.js";

/** The catalog of the profiles it is built from, which are held in the order they were given. The
 * canonical list is the same profiles in the order the messages name them: a list that adds or
 * drops one is refused, so neither order can drift from the other. */
export class RegisteredToolCatalog implements ToolCatalog {
  readonly #byId = new Map<string, BuiltToolConfig>();
  readonly #canonical: readonly BuiltToolConfig[];

  constructor(profiles: readonly BuiltToolConfig[], canonical: readonly BuiltToolConfig[]) {
    for (const profile of profiles) {
      if (this.#byId.has(profile.toolId)) throw new DuplicateToolIdError(profile.toolId);
      this.#byId.set(profile.toolId, profile);
    }
    const ordered = new Set<string>(canonical.map((profile) => profile.toolId));
    const differing = [
      ...[...this.#byId.keys()].filter((id) => !ordered.has(id)),
      ...[...ordered].filter((id) => !this.#byId.has(id)),
    ];
    if (differing.length > 0) {
      throw new ToolOrderMismatchError(differing);
    }
    this.#canonical = canonical;
  }

  toolId(raw: string): ToolId | null {
    return this.#byId.get(raw)?.toolId ?? null;
  }

  aiToolId(raw: string): AiToolId | null {
    const profile = this.#byId.get(raw);
    return profile?.kind === "ai" ? profile.toolId : null;
  }

  categoryOf(id: ToolId): ToolCategory {
    return this.profile(id).kind;
  }

  profile(id: ToolId): ToolProfile {
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
    return idsOf([...this.#byId.values()], category);
  }

  idsInCanonicalOrder(category: "ai"): readonly AiToolId[];
  idsInCanonicalOrder(category?: ToolCategory): readonly ToolId[];
  idsInCanonicalOrder(category?: ToolCategory): readonly ToolId[] {
    return idsOf(this.#canonical, category);
  }

  sortedById(): readonly ToolProfile[] {
    return [...this.#byId.values()].sort((a, b) =>
      a.toolId < b.toolId ? -1 : a.toolId > b.toolId ? 1 : 0
    );
  }
}

function idsOf(profiles: readonly BuiltToolConfig[], category?: ToolCategory): ToolId[] {
  return profiles
    .filter((profile) => category === undefined || profile.kind === category)
    .map((profile) => profile.toolId);
}

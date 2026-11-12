import { DuplicateToolIdError, UnregisteredToolError } from "../../../kernel/errors.js";
import type { AiToolId, ToolCategory, ToolId } from "../../../kernel/tool.js";
import type { ToolCatalog } from "../contract/tool-catalog.js";
import type { AiToolProfile, ToolProfile } from "../contract/tool-profile.js";
import type { BuiltToolConfig } from "../domain/profile/define-tool.js";

/** The catalog of the profiles it is built from, which are held in the order they were given. */
export class RegisteredToolCatalog implements ToolCatalog {
  readonly #byId = new Map<ToolId, BuiltToolConfig>();

  constructor(profiles: readonly BuiltToolConfig[]) {
    for (const profile of profiles) {
      if (this.#byId.has(profile.toolId)) throw new DuplicateToolIdError(profile.toolId);
      this.#byId.set(profile.toolId, profile);
    }
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

  inHelpOrder(category: ToolCategory): readonly ToolId[] {
    return [...this.#byId.values()]
      .filter((profile) => profile.kind === category)
      .map((profile) => profile.toolId);
  }

  sortedById(): readonly ToolProfile[] {
    return [...this.#byId.values()].sort((a, b) =>
      a.toolId < b.toolId ? -1 : a.toolId > b.toolId ? 1 : 0
    );
  }
}

import type { ToolCategory, ToolId } from "../../../kernel/tool.js";
import type { ToolCatalog } from "../contract/tool-catalog.js";
import type { ToolProfile } from "../contract/tool-profile.js";
import { type BuiltToolConfig, ToolCatalog as ProfileIndex } from "../domain/registry.js";

/** The catalog of the profiles it is built from, which are held in the order they were given. */
export class RegisteredToolCatalog implements ToolCatalog {
  readonly #profiles: ProfileIndex;

  constructor(profiles: readonly BuiltToolConfig[]) {
    this.#profiles = new ProfileIndex(profiles);
  }

  profile(id: ToolId): ToolProfile {
    return this.#profiles.getToolConfig(id);
  }

  inHelpOrder(category: ToolCategory): readonly ToolId[] {
    return [...this.#profiles.getAllRegisteredTools().values()]
      .filter((profile) => profile.kind === category)
      .map((profile) => profile.toolId);
  }

  sortedById(): readonly ToolProfile[] {
    return [...this.#profiles.getAllRegisteredTools().values()].sort((a, b) =>
      a.toolId < b.toolId ? -1 : a.toolId > b.toolId ? 1 : 0
    );
  }
}

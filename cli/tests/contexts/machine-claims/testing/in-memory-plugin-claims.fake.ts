import type { PluginClaimsRepository } from "../../../../src/contexts/machine-claims/ports/plugin-claims-repository.js";
import type { ToolId } from "../../../../src/shared/domain/tool.js";

/** The claims of one scope, kept in memory as the file would keep them. */
export class InMemoryPluginClaims implements PluginClaimsRepository {
  private kept = new Map<ToolId, unknown>();

  async load(): Promise<Map<ToolId, unknown>> {
    return new Map(this.kept);
  }

  async save(claims: ReadonlyMap<ToolId, unknown>): Promise<void> {
    this.kept = new Map(claims);
  }
}

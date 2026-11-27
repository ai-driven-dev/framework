import type { ServerPluginLedger } from "../../../src/contexts/host-registration/ports/server/server-plugin-ledger.js";
import type { ToolId } from "../../../src/shared/domain/tool.js";

/** Keeps the owned plugins in memory. */
export class FakeServerPluginLedger implements ServerPluginLedger {
  constructor(public owned: Map<ToolId, readonly string[]> = new Map()) {}

  async load(): Promise<Map<ToolId, readonly string[]>> {
    return new Map(this.owned);
  }

  async save(owned: ReadonlyMap<ToolId, readonly string[]>): Promise<void> {
    this.owned = new Map(owned);
  }
}

import type {
  ScopeRecords,
  ToolRecord,
  ToolRecords,
} from "../../contract/records/scope-records.js";
import type { RegisteredMarketplace } from "../sync/record-activation.use-case.js";

/** What forgetting a catalogue asks of a tool's record, the caller's to answer. */
export interface MarketplaceForgetting {
  /** The registration the alias stands for, `undefined` when it was never registered. */
  marketplaceOf(registrations: ToolRecord, alias: string): RegisteredMarketplace | undefined;
  /** The record without the marketplace, nor any ref or claim on its host name. */
  withoutMarketplace(registrations: ToolRecord, alias: string): ToolRecord;
}

/** Takes the marketplace out of each tool's record that registered it, leaving the others as
 * they are. */
export function forgetMarketplaceIn(
  records: ToolRecords,
  alias: string,
  rules: MarketplaceForgetting
): void {
  for (const [toolId, record] of records) {
    if (rules.marketplaceOf(record, alias) !== undefined)
      records.set(toolId, rules.withoutMarketplace(record, alias));
  }
}

/** Forgets the marketplace from every tool's record of one scope, as saved. */
export async function forgetMarketplaceInRecords(
  records: ScopeRecords & MarketplaceForgetting,
  alias: string
): Promise<void> {
  const held = await records.loadRecords();
  forgetMarketplaceIn(held, alias, records);
  await records.saveRecords(held);
}

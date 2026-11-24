import type { ToolId } from "../../../../shared/domain/tool.js";
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

/** Which marketplace to forget, and from the records of which tools: a record is only ever
 * written for an AI tool, but a hand-edited manifest can hold one for another. */
export interface MarketplaceForgotten {
  readonly alias: string;
  readonly toolIds: readonly ToolId[];
}

/** Takes the marketplace out of each listed tool's record that registered it, leaving the others
 * as they are. */
export function forgetMarketplaceIn(
  records: ToolRecords,
  { alias, toolIds }: MarketplaceForgotten,
  rules: MarketplaceForgetting
): void {
  for (const toolId of toolIds) {
    const record = records.get(toolId);
    if (record !== undefined && rules.marketplaceOf(record, alias) !== undefined)
      records.set(toolId, rules.withoutMarketplace(record, alias));
  }
}

/** Forgets the marketplace from the listed tools' records of one scope, as saved. */
export async function forgetMarketplaceInRecords(
  records: ScopeRecords & MarketplaceForgetting,
  forgotten: MarketplaceForgotten
): Promise<void> {
  const held = await records.loadRecords();
  forgetMarketplaceIn(held, forgotten, records);
  await records.saveRecords(held);
}

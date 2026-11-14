import type {
  LeftOutEntry,
  LeftOutReason,
  LeftOutStore,
} from "../../../../src/contexts/telemetry/ports/usage-ledger.js";

/** What was measured and left out, as the text each thing is named by, unhashed. Shares its
 * ledger's events: `left-out` when counted, `left-out-add` when added to. */
export class InMemoryLeftOut implements LeftOutStore {
  readonly lines = new Set<string>();
  /** Things handed to `add`, kept or not. */
  added = 0;
  failSave = false;
  constructor(readonly events: string[]) {}

  async add(entries: readonly LeftOutEntry[]): Promise<void> {
    this.events.push("left-out-add");
    if (this.failSave) throw new Error("disk full");
    this.added += entries.length;
    for (const { reason, of } of entries) this.lines.add(`${reason} ${of}`);
  }

  async counts(): Promise<Readonly<Record<LeftOutReason, number>>> {
    this.events.push("left-out");
    const count = (reason: LeftOutReason) =>
      [...this.lines].filter((line) => line.startsWith(`${reason} `)).length;
    return {
      undated: count("undated"),
      unrecognised: count("unrecognised"),
      requestless: count("requestless"),
    };
  }
}

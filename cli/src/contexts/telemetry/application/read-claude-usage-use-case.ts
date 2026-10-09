import { readClaudeUsageLine } from "../domain/formats/claude-transcript-usage.js";
import type { TranscriptSource } from "../domain/ports/transcript-source.js";
import type { TranscriptPosition } from "../domain/transcript-position.js";
import { foldUsage } from "../domain/usage-fold.js";
import type { UsageRecord } from "../domain/usage-record.js";

export interface ClaudeUsageReading {
  /** One record per billed call, folded across every file read. */
  readonly records: readonly UsageRecord[];
  /** Where each file read now stands, to hand back next time. */
  readonly positions: ReadonlyMap<string, TranscriptPosition>;
  /** Shapes seen and not recognised, each prefixed with its file. */
  readonly unrecognised: readonly string[];
  /** When the oldest transcript on disk was last written, `null` when there is none. */
  readonly oldestTranscriptAt: string | null;
}

export class ReadClaudeUsageUseCase {
  constructor(private readonly source: TranscriptSource) {}

  async execute(since: ReadonlyMap<string, TranscriptPosition>): Promise<ClaudeUsageReading> {
    const candidates: UsageRecord[] = [];
    const unrecognised: string[] = [];
    const positions = new Map(since);
    const paths = await this.source.list();
    for (const path of paths) {
      const read = await this.source.read(path, since.get(path) ?? null);
      positions.set(path, read.position);
      for (const line of read.lines) {
        const outcome = readClaudeUsageLine(line);
        candidates.push(...outcome.records);
        unrecognised.push(...outcome.unrecognised.map((reason) => `${path}: ${reason}`));
      }
    }
    return {
      records: foldUsage(candidates),
      positions,
      unrecognised,
      oldestTranscriptAt: await this.source.oldestModified(paths),
    };
  }
}

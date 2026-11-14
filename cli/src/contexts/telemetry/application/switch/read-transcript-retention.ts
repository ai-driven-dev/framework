import { effectiveRetentionDays, retentionShort } from "../../domain/switch/claude-retention.js";
import type { RetentionSettingsSource } from "../../ports/switch/retention-settings-source.js";

export interface ReadTranscriptRetentionCommand {
  /** The clone's root, where Claude Code's project settings live. */
  readonly root: string;
}

/** How long Claude Code keeps a transcript, and whether that is short of what history needs. */
export interface ReadTranscriptRetentionResult {
  readonly days: number;
  readonly short: boolean;
}

/** Reads how long Claude Code keeps a transcript, from its settings files. */
export class ReadTranscriptRetention {
  constructor(private readonly settings: RetentionSettingsSource) {}

  async execute({ root }: ReadTranscriptRetentionCommand): Promise<ReadTranscriptRetentionResult> {
    const days = effectiveRetentionDays(await this.settings.texts(root));
    return { days, short: retentionShort(days) };
  }
}

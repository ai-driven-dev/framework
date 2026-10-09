import type { ConsentSource } from "../../domain/ports/consent-source.js";
import type { RepositoryLocator } from "../../domain/ports/repository-locator.js";
import type { ResolutionStore } from "../../domain/ports/resolution-store.js";
import type { ClaudeSettingsSource } from "../../domain/ports/switch/claude-settings-source.js";
import type {
  HookCleanup,
  LegacyHookCleaner,
} from "../../domain/ports/switch/legacy-hook-cleaner.js";
import type { ProjectConfigWriter } from "../../domain/ports/switch/project-config-writer.js";
import type {
  JournalCleanup,
  RunJournalCleaner,
} from "../../domain/ports/switch/run-journal-cleaner.js";
import type { UsageLedger } from "../../domain/ports/usage-ledger.js";
import { effectiveRetentionDays, retentionShort } from "../../domain/switch/claude-retention.js";
import { switchedOn } from "../../domain/switch/consent-switch.js";
import { withConsentGranted } from "../../domain/switch/resolution-consent.js";

export type OnResult =
  | { readonly status: "refused"; readonly reason: "outside-repository" | "unreadable-config" }
  | {
      readonly status: "on";
      /** `false` when the project already granted this version. */
      readonly configWritten: boolean;
      readonly hook: HookCleanup;
      readonly journal: JournalCleanup;
      /** How long Claude Code keeps a transcript, and whether that is short of what history
       * needs. */
      readonly retention: { readonly days: number; readonly short: boolean };
    };

/** Opts a repository in and leaves it as if the previous measurement had never run. */
export class TelemetryOnUseCase {
  constructor(
    private readonly locator: RepositoryLocator,
    private readonly consents: ConsentSource,
    private readonly config: ProjectConfigWriter,
    private readonly hooks: LegacyHookCleaner,
    private readonly journal: RunJournalCleaner,
    private readonly ledger: UsageLedger,
    private readonly resolutions: ResolutionStore,
    private readonly claudeSettings: ClaudeSettingsSource,
    private readonly caseInsensitiveFileSystem: boolean
  ) {}

  async execute(cwd: string): Promise<OnResult> {
    const located = await this.locator.locate(cwd);
    if (located.status !== "repository") return { status: "refused", reason: "outside-repository" };
    const switched = switchedOn(await this.consents.read(located.root));
    if (switched.status === "unreadable") return { status: "refused", reason: "unreadable-config" };
    if (switched.status === "switched") await this.config.write(located.root, switched.text);

    // Pairing and removal live in one adapter call: the line and its script go together.
    const hook = await this.hooks.clean(located.root);
    const journal = await this.journal.clean(located.root);
    await this.catchUp([located.root, located.mainRoot]);

    const days = effectiveRetentionDays(await this.claudeSettings.texts(located.root));
    return {
      status: "on",
      configWritten: switched.status === "switched",
      hook,
      journal,
      retention: { days, short: retentionShort(days) },
    };
  }

  /** Under the ledger's lock, or an ingest already running would save the offsets this run
   * reset. Ingest advanced them past lines it did not store for want of consent, and the same
   * lines belong in the ledger now: calls are kept once, so reading them again costs nothing. */
  private async catchUp(roots: readonly string[]): Promise<void> {
    await this.ledger.exclusively(async () => {
      await this.ledger.resetPositions();
      const held = await this.resolutions.load();
      const granted = withConsentGranted(held, roots, this.caseInsensitiveFileSystem);
      if (granted.changed) await this.resolutions.save(granted.resolutions);
    });
  }
}

import type { ConsentSource } from "../../domain/ports/consent-source.js";
import type { LocatedDirectory, RepositoryLocator } from "../../domain/ports/repository-locator.js";
import type { ResolutionStore } from "../../domain/ports/resolution-store.js";
import type { ClaudeSettingsSource } from "../../domain/ports/switch/claude-settings-source.js";
import type { ConsentWriter } from "../../domain/ports/switch/consent-writer.js";
import type {
  HookCleanup,
  LegacyHookCleaner,
} from "../../domain/ports/switch/legacy-hook-cleaner.js";
import type { ProjectConfigFile } from "../../domain/ports/switch/project-config-file.js";
import type {
  JournalCleanup,
  RunJournalCleaner,
} from "../../domain/ports/switch/run-journal-cleaner.js";
import type { UsageLedger } from "../../domain/ports/usage-ledger.js";
import { effectiveRetentionDays, retentionShort } from "../../domain/switch/claude-retention.js";
import { withoutPreviousTelemetry } from "../../domain/switch/legacy-config.js";
import { CONSENT_GRANTED } from "../../domain/telemetry-consent.js";
import { readCloneConsent } from "./clone-consent.js";
import { rememberOwnRoot } from "./remembered-consent.js";

export type LegacyConfigOutcome = "none" | "block-removed" | "file-deleted" | "unparseable";

export type OnResult =
  | { readonly status: "refused"; readonly reason: "outside-repository" | "unreadable-git-config" }
  | {
      readonly status: "on";
      /** `false` when the clone already granted this version. */
      readonly consentWritten: boolean;
      /** What was done to the previous version's block in `.aidd/config.json`, a file a team
       * may track. */
      readonly legacyConfig: LegacyConfigOutcome;
      readonly hook: HookCleanup;
      readonly journal: JournalCleanup;
      /** How long Claude Code keeps a transcript, and whether that is short of what history
       * needs. */
      readonly retention: { readonly days: number; readonly short: boolean };
    };

/** Opts a clone in, in its own git config, and leaves it as if the previous measurement had
 * never run. */
export class TelemetryOnUseCase {
  constructor(
    private readonly locator: RepositoryLocator,
    private readonly consents: ConsentSource,
    private readonly writer: ConsentWriter,
    private readonly config: ProjectConfigFile,
    private readonly hooks: LegacyHookCleaner,
    private readonly journal: RunJournalCleaner,
    private readonly ledger: UsageLedger,
    private readonly resolutions: ResolutionStore,
    private readonly claudeSettings: ClaudeSettingsSource,
    private readonly caseInsensitiveFileSystem: boolean
  ) {}

  async execute(cwd: string): Promise<OnResult> {
    const clone = await readCloneConsent(this.locator, this.consents, cwd);
    if (clone.status === "refused") return clone;
    const { located } = clone;
    const consentWritten = clone.value !== CONSENT_GRANTED;
    if (consentWritten) await this.writer.set(located.root, CONSENT_GRANTED);
    const legacyConfig = await this.clearLegacyConfig(located.root);

    // Pairing and removal live in one adapter call: the line and its script go together.
    const hook = await this.hooks.clean(located.root);
    const journal = await this.journal.clean(located.root);
    await this.catchUp(located);

    const days = effectiveRetentionDays(await this.claudeSettings.texts(located.root));
    return {
      status: "on",
      consentWritten,
      legacyConfig,
      hook,
      journal,
      retention: { days, short: retentionShort(days) },
    };
  }

  /** The block the previous version wrote in `.aidd/config.json` means nothing to this one:
   * removed, the rest of the file as it was, and the file itself only when nothing else is
   * in it. */
  private async clearLegacyConfig(root: string): Promise<LegacyConfigOutcome> {
    const cleaning = withoutPreviousTelemetry(await this.config.read(root));
    if (cleaning.status === "block-removed") {
      await this.config.write(root, cleaning.text);
      return "block-removed";
    }
    if (cleaning.status === "file-emptied") {
      await this.config.remove(root);
      return "file-deleted";
    }
    return cleaning.status;
  }

  /** Under the ledger's lock, or an ingest already running would save the offsets this run
   * reset. Ingest advanced them past lines it did not store for want of consent, and the same
   * lines belong in the ledger now: calls are kept once, so reading them again costs nothing.
   * The clone's directories that are gone are not rewritten: their consent is read from the
   * clone, live. */
  private async catchUp(
    located: Extract<LocatedDirectory, { status: "repository" }>
  ): Promise<void> {
    await this.ledger.exclusively(async () => {
      await this.ledger.resetPositions();
      await rememberOwnRoot(this.resolutions, located, this.caseInsensitiveFileSystem);
    });
  }
}

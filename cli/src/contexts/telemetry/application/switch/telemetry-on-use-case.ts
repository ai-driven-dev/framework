import type { CloneIdentity } from "../../domain/consent/clone-identity.js";
import type { ConsentHistory } from "../../domain/ports/consent-history.js";
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
import { consentValue, tokenOfKey } from "../../domain/telemetry-consent.js";
import { ConsentLog } from "../consent-log.js";
import type { ResolutionEnvironment } from "../directory-resolver.js";
import { readCloneConsent } from "./clone-consent.js";
import { rememberOwnRoot } from "./remember-own-root.js";

type Located = Extract<LocatedDirectory, { status: "repository" }>;

export type LegacyConfigOutcome = "none" | "block-removed" | "file-deleted" | "unparseable";

export type OnResult =
  | {
      readonly status: "refused";
      /** `unidentified-clone`: the file system gives the clone's git dir no identity, so
       * nothing measured could be told to be its own. */
      readonly reason: "outside-repository" | "unreadable-git-config" | "unidentified-clone";
    }
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
 * never run. Measurement starts here: nothing made before is read back. */
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
    private readonly history: ConsentHistory,
    private readonly claudeSettings: ClaudeSettingsSource,
    private readonly environment: ResolutionEnvironment,
    /** A fresh random token for each interval. */
    private readonly newToken: () => string
  ) {}

  async execute(cwd: string): Promise<OnResult> {
    const clone = await readCloneConsent(this.locator, this.consents, cwd);
    if (clone.status === "refused") return clone;
    const { located } = clone;
    const identity = located.clone;
    if (identity === null) return { status: "refused", reason: "unidentified-clone" };
    const consentWritten = await this.ledger.exclusively(() => this.grant(located.root, identity));
    const legacyConfig = await this.clearLegacyConfig(located.root);

    // Pairing and removal live in one adapter call: the line and its script go together.
    const hook = await this.hooks.clean(located.root);
    const journal = await this.journal.clean(located.root);
    await this.rememberRoot(located);

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

  /** Under the ledger's lock, so an ingest sees the key and the interval together. A key that
   * names an interval open for this very clone is already consent. Any other is replaced by a
   * fresh token: the key first, so that a crash between the two leaves a key with no interval,
   * which measures nothing, and not an interval its own key does not name, which a hook would
   * close. */
  private async grant(root: string, identity: CloneIdentity): Promise<boolean> {
    const log = await ConsentLog.load(this.history);
    // Read again under the lock: another `on` may have written it since the first look.
    const reading = await this.consents.read(root);
    const held = reading.kind === "value" ? tokenOfKey(reading.value) : null;
    const open = log.openFor(identity);
    if (held !== null && open.some((interval) => interval.token === held)) return false;
    const at = this.environment.now();
    for (const stale of open) await log.close(stale.token, at);
    const token = this.newToken();
    await this.writer.set(root, consentValue(token));
    await log.open(identity, token, at);
    return true;
  }

  /** Under the ledger's lock, which every writer of `roots.json` holds. */
  private async rememberRoot(located: Located): Promise<void> {
    await this.ledger.exclusively(() =>
      rememberOwnRoot(
        this.resolutions,
        located,
        this.environment.caseInsensitiveFileSystem,
        this.environment.now()
      )
    );
  }
}

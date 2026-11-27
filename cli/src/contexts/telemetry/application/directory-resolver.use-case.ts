import { cloneKey } from "../domain/consent/clone-identity.js";
import { closeEvent } from "../domain/consent/consent-history.js";
import { ConsentLog } from "../domain/consent/consent-log.js";
import { RememberedResolutions } from "../domain/remembered-resolutions.js";
import { tokenOf } from "../domain/telemetry-consent.js";
import type { ConsentHistory } from "../ports/consent-history.js";
import type { ConsentSource } from "../ports/consent-source.js";
import type { ResolutionStore } from "../ports/resolution-store.js";
import type { ResolutionRun, StartResolutionRun } from "./resolution-run.js";

interface DirectoryResolverDeps {
  readonly consentSource: ConsentSource;
  readonly store: ResolutionStore;
  readonly history: ConsentHistory;
  readonly startRun: StartResolutionRun;
  readonly now: () => Date;
}

/** Decides, for a billed call, whether it is stored: the rule is in the usage contract. The
 * directory it was made in must have been seen alive, in a clone, and that clone must have had
 * an open consent interval at the call's time. A clone is told from another made at the same
 * path by its identity, never by its path or its remote. The clone's own key is not asked at
 * the call: the intervals are the truth, and an interval is closed as soon as anything sees the
 * key stop naming it. */
export class DirectoryResolver {
  constructor(private readonly deps: DirectoryResolverDeps) {}

  /** One run, under the ledger's lock: `work` asks it for verdicts, and what it learned is kept
   * once `work` is done. Every open interval is looked at first, so that a clone that stopped
   * consenting, or went, is closed whether or not a call of it is read. */
  async execute<T>(work: (run: ResolutionRun) => Promise<T>): Promise<T> {
    const remembered = new RememberedResolutions(await this.deps.store.load());
    const { consents, unreadable } = await this.observeOpenConsents();
    const run = this.deps.startRun({ remembered, consents, unreadable });
    const done = await work(run);
    if (run.learned.changed) await this.deps.store.save(run.learned.sightings);
    return done;
  }

  /** Closes, at this moment, the earliest anyone knows, every open interval whose clone is
   * another directory now, or no longer names the interval's token in its key. A clone with
   * nothing at its path is left open: it may only be out of reach, and a directory made at its
   * path since is seen as another one. A clone whose git config could not be read is neither
   * kept nor closed. */
  private async observeOpenConsents(): Promise<{
    consents: ConsentLog;
    unreadable: ReadonlySet<string>;
  }> {
    let consents = await this.consentLog();
    const unreadable = new Set<string>();
    for (const interval of consents.openIntervals()) {
      const reading = await this.deps.consentSource.readClone(interval.clone);
      if (reading.kind === "unreadable") {
        unreadable.add(cloneKey(interval.clone));
        continue;
      }
      if (reading.kind === "absent") continue;
      if (tokenOf(reading) !== interval.token) {
        await this.deps.history.append(closeEvent(interval.token, this.deps.now()));
        consents = await this.consentLog();
      }
    }
    return { consents, unreadable };
  }

  private async consentLog(): Promise<ConsentLog> {
    return new ConsentLog(await this.deps.history.read());
  }
}

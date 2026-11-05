import { sameClone } from "../../domain/consent/clone-identity.js";
import { foldConsent } from "../../domain/consent/consent-history.js";
import type { ConsentHistory } from "../../domain/ports/consent-history.js";
import type { UsageLedger } from "../../domain/ports/usage-ledger.js";
import { coversConsentWindow, type SessionAdmission } from "../../domain/report/session-feature.js";
import type { DirectoryResolver } from "../directory-resolver.js";

export class SessionConsent {
  constructor(
    private readonly ledger: UsageLedger,
    private readonly directories: DirectoryResolver,
    private readonly consents: ConsentHistory
  ) {}

  /** Cumulative metrics are permitted only when their complete interval belongs to the same
   * clone and one uninterrupted consent interval. */
  async permits(
    admission: SessionAdmission,
    at: string,
    start?: string,
    current?: string
  ): Promise<"allow" | "deny" | "unknown"> {
    const endTime = Date.parse(at);
    const startTime = start === undefined ? endTime : Date.parse(start);
    const currentTime = current === undefined ? endTime : Date.parse(current);
    if (
      !admission.cwd ||
      !admission.repositoryId ||
      !Number.isFinite(endTime) ||
      !Number.isFinite(startTime) ||
      !Number.isFinite(currentTime) ||
      startTime > endTime ||
      currentTime < endTime
    )
      return "unknown";
    return this.ledger.exclusively(async () => {
      const run = await this.directories.open();
      try {
        const first = await run.resolve(admission.cwd ?? "", new Date(startTime).toISOString());
        const last = await run.resolve(admission.cwd ?? "", new Date(endTime).toISOString());
        const now =
          current === undefined
            ? last
            : await run.resolve(admission.cwd ?? "", new Date(currentTime).toISOString());
        if ("skipped" in first || "skipped" in last || "skipped" in now) {
          const reasons = [first, last, now].flatMap((value) =>
            "skipped" in value ? [value.skipped] : []
          );
          return reasons.some(
            (reason) => reason === "unreadable-consent" || reason === "never-seen-alive"
          )
            ? "unknown"
            : "deny";
        }
        if (
          !sameClone(first.stored.clone, last.stored.clone) ||
          !sameClone(first.stored.clone, now.stored.clone) ||
          first.stored.repository_id !== admission.repositoryId ||
          last.stored.repository_id !== admission.repositoryId ||
          now.stored.repository_id !== admission.repositoryId
        )
          return "deny";
        const history = await this.consents.read();
        if (history.damaged) return "unknown";
        const intervals = foldConsent(history.events);
        return coversConsentWindow(intervals, first.stored.clone, startTime, endTime) &&
          coversConsentWindow(intervals, first.stored.clone, currentTime, currentTime)
          ? "allow"
          : "deny";
      } finally {
        await run.close();
      }
    });
  }
}

import type { ConsentHistory } from "../domain/ports/consent-history.js";
import type { ConsentSource } from "../domain/ports/consent-source.js";
import type { RepositoryLocator } from "../domain/ports/repository-locator.js";
import { repositoryIdOf } from "../domain/repository-identity.js";
import { consentOf, tokenOfKey } from "../domain/telemetry-consent.js";
import { ConsentLog } from "./consent-log.js";

export type RefusalReason =
  | "environment"
  | "outside-repository"
  | "unidentified-repository"
  | "no-consent"
  | "unreadable-consent";

export type ConsentedRepository =
  | { readonly status: "open"; readonly repositoryId: string; readonly root: string }
  | { readonly status: "refused"; readonly reason: RefusalReason };

/** The repository a directory is in, when its clone is measured: its key names an interval
 * that is open for it, the same test the hooks make. A declaration is stored only for a clone
 * that asked to be measured, never for one whose key was set by hand or came with a copy. */
export class ConsentedRepositories {
  constructor(
    private readonly locator: RepositoryLocator,
    private readonly consents: ConsentSource,
    private readonly history: ConsentHistory
  ) {}

  async open(cwd: string): Promise<ConsentedRepository> {
    const located = await this.locator.locate(cwd);
    if (located.status !== "repository") return { status: "refused", reason: "outside-repository" };
    const repositoryId = repositoryIdOf(located);
    if (repositoryId === null) return { status: "refused", reason: "unidentified-repository" };
    const reading = await this.consents.read(located.root);
    const consent = consentOf(reading);
    if (consent === "unreadable") return { status: "refused", reason: "unreadable-consent" };
    if (consent === "absent") return { status: "refused", reason: "no-consent" };
    const log = await ConsentLog.load(this.history);
    // A log that cannot be read, or a clone the platform cannot identify, measures nothing.
    if (log.damaged || located.clone === null) {
      return { status: "refused", reason: "unreadable-consent" };
    }
    const token = tokenOfKey(reading.kind === "value" ? reading.value : null);
    const named = log.openFor(located.clone).some((interval) => interval.token === token);
    if (!named) return { status: "refused", reason: "no-consent" };
    return { status: "open", repositoryId, root: located.root };
  }
}

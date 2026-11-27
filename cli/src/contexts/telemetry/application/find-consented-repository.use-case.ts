import type { Environment } from "../../../shared/ports/environment.js";
import { repositoryIdOf } from "../domain/repository-identity.js";
import type { LocatedDirectory } from "../domain/resolution/located-directory.js";
import {
  type ConsentReading,
  consentOf,
  MEASUREMENT_SWITCH,
  measurementRefused,
  tokenOf,
  turnedOff,
} from "../domain/telemetry-consent.js";
import type { ConsentSource } from "../ports/consent-source.js";
import type { RepositoryLocator } from "../ports/repository-locator.js";
import type { LoadConsentLog } from "./consent/load-consent-log.use-case.js";

export type RefusalReason =
  | "environment"
  | "outside-repository"
  | "unidentified-repository"
  | "no-consent"
  | "turned-off"
  | "unreadable-consent";

export type ConsentedRepository =
  | {
      readonly status: "open";
      readonly repositoryId: string;
      readonly root: string;
      /** When the interval the key names opened. */
      readonly since: string;
    }
  | { readonly status: "refused"; readonly reason: RefusalReason };

type Located = Extract<LocatedDirectory, { status: "repository" }>;
type Opened = { readonly since: string } | { readonly reason: RefusalReason };

const refused = (reason: RefusalReason): ConsentedRepository => ({ status: "refused", reason });

const outsideReason = (located: LocatedDirectory): RefusalReason =>
  located.status === "unreadable" ? "unreadable-consent" : "outside-repository";

/** Why a clone's own key refuses it before its history is consulted, or `null`. */
function keyRefusal(reading: ConsentReading): RefusalReason | null {
  const consent = consentOf(reading);
  if (consent === "unreadable") return "unreadable-consent";
  return consent === "absent" && !turnedOff(reading) ? "no-consent" : null;
}

/** The repository a directory is in, when its clone is measured: the environment does not turn
 * measurement off, and its key names an interval
 * that is open for it, the same test the hooks make. A declaration is stored only for a clone
 * that asked to be measured, never for one whose key was set by hand or came with a copy. */
export class FindConsentedRepository {
  constructor(
    private readonly locator: RepositoryLocator,
    private readonly consents: ConsentSource,
    private readonly loadLog: LoadConsentLog,
    private readonly environment: Environment
  ) {}

  async execute(cwd: string): Promise<ConsentedRepository> {
    if (measurementRefused(this.environment.get(MEASUREMENT_SWITCH))) return refused("environment");
    const located = await this.locator.locate(cwd);
    if (located.status !== "repository") return refused(outsideReason(located));
    const repositoryId = repositoryIdOf(located);
    if (repositoryId === null) return refused("unidentified-repository");
    const opened = await this.intervalOf(located);
    if ("reason" in opened) return refused(opened.reason);
    return { status: "open", repositoryId, root: located.root, since: opened.since };
  }

  private async intervalOf(located: Located): Promise<Opened> {
    const reading = await this.consents.read(located.root);
    const refusal = keyRefusal(reading);
    if (refusal !== null) return { reason: refusal };
    const log = await this.loadLog.execute();
    // A log that cannot be read, or a clone the platform cannot identify, measures nothing. A
    // clone turned off is told so only past this point, where `on` would not refuse it.
    if (log.damaged || located.clone === null) return { reason: "unreadable-consent" };
    if (turnedOff(reading)) return { reason: "turned-off" };
    const token = tokenOf(reading);
    const named = log.openFor(located.clone).find((interval) => interval.token === token);
    if (named === undefined) return { reason: "no-consent" };
    return { since: new Date(named.from).toISOString() };
  }
}

import type { ConsentSource } from "../../domain/ports/consent-source.js";
import type { RepositoryLocator } from "../../domain/ports/repository-locator.js";
import type { ResolutionStore } from "../../domain/ports/resolution-store.js";
import type { ConsentWriter } from "../../domain/ports/switch/consent-writer.js";
import type { UsageLedger } from "../../domain/ports/usage-ledger.js";
import { CONSENT_GRANTED, CONSENT_WITHDRAWN } from "../../domain/telemetry-consent.js";
import { readCloneConsent } from "./clone-consent.js";
import { forgetConsentOfClone } from "./remembered-consent.js";

export type OffResult =
  | { readonly status: "refused"; readonly reason: "outside-repository" | "unreadable-git-config" }
  | { readonly status: "off"; readonly changed: boolean };

/** Stops reading this clone. What was already measured stays until `forget`. */
export class TelemetryOffUseCase {
  constructor(
    private readonly locator: RepositoryLocator,
    private readonly consents: ConsentSource,
    private readonly writer: ConsentWriter,
    private readonly ledger: UsageLedger,
    private readonly resolutions: ResolutionStore
  ) {}

  async execute(cwd: string): Promise<OffResult> {
    const clone = await readCloneConsent(this.locator, this.consents, cwd);
    if (clone.status === "refused") return clone;
    const granted = clone.value === CONSENT_GRANTED;
    if (granted) await this.writer.set(clone.located.root, CONSENT_WITHDRAWN);
    // Under the ledger's lock, or an ingest running now would save the yes it remembered.
    await this.ledger.exclusively(() =>
      forgetConsentOfClone(this.resolutions, clone.located.clone)
    );
    return { status: "off", changed: granted };
  }
}

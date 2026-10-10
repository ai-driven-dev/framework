import type { ConsentSource } from "../../domain/ports/consent-source.js";
import type { RepositoryLocator } from "../../domain/ports/repository-locator.js";
import type { ConsentWriter } from "../../domain/ports/switch/consent-writer.js";
import { CONSENT_GRANTED, CONSENT_WITHDRAWN } from "../../domain/telemetry-consent.js";
import { readCloneConsent } from "./clone-consent.js";

export type OffResult =
  | { readonly status: "refused"; readonly reason: "outside-repository" | "unreadable-git-config" }
  | { readonly status: "off"; readonly changed: boolean };

/** Stops reading this clone. What was already measured stays until `forget`. */
export class TelemetryOffUseCase {
  constructor(
    private readonly locator: RepositoryLocator,
    private readonly consents: ConsentSource,
    private readonly writer: ConsentWriter
  ) {}

  async execute(cwd: string): Promise<OffResult> {
    const clone = await readCloneConsent(this.locator, this.consents, cwd);
    if (clone.status === "refused") return clone;
    if (clone.value !== CONSENT_GRANTED) return { status: "off", changed: false };
    await this.writer.set(clone.located.root, CONSENT_WITHDRAWN);
    return { status: "off", changed: true };
  }
}

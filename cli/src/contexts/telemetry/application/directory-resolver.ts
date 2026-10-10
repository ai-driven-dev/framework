import type { ConsentSource } from "../domain/ports/consent-source.js";
import type { RepositoryLocator } from "../domain/ports/repository-locator.js";
import type { ResolutionStore } from "../domain/ports/resolution-store.js";
import { repositoryIdOf } from "../domain/repository-identity.js";
import {
  cwdKey,
  type NotStoredReason,
  type RepositoryResolution,
  sameResolution,
} from "../domain/repository-resolution.js";
import { type Consent, consentOf } from "../domain/telemetry-consent.js";
import { consentOfRoot } from "./repository-consent.js";

export type DirectoryOutcome =
  | {
      readonly stored: RepositoryResolution;
      /** Resolved from the directory as it stands, not from what was remembered of it. */
      readonly live: boolean;
    }
  | { readonly skipped: NotStoredReason };

/** Ties a working directory to a repository and to its clone's consent. A directory that
 * exists is resolved as it stands, so a clone that opts out is not measured on the strength
 * of an earlier look. One that is gone is judged by the clone it was remembered in, read live
 * while that clone exists, and by what was remembered of it only once the clone is gone too. One
 * never seen alive cannot be proved to have consented. */
export class DirectoryResolver {
  constructor(
    private readonly locator: RepositoryLocator,
    private readonly consentSource: ConsentSource,
    private readonly store: ResolutionStore,
    private readonly caseInsensitiveFileSystem: boolean
  ) {}

  /** One run: a directory is looked at once, however many calls it made. */
  async open(): Promise<ResolutionRun> {
    return new ResolutionRun(
      this.locator,
      this.consentSource,
      this.store,
      await this.store.load(),
      this.caseInsensitiveFileSystem
    );
  }
}

export class ResolutionRun {
  private changed = false;
  private readonly outcomes = new Map<string, DirectoryOutcome>();
  private readonly consents = new Map<string, Consent>();
  private readonly cloneConsents = new Map<string, Consent | "gone">();

  constructor(
    private readonly locator: RepositoryLocator,
    private readonly consentSource: ConsentSource,
    private readonly store: ResolutionStore,
    private readonly remembered: Map<string, RepositoryResolution>,
    private readonly caseInsensitiveFileSystem: boolean
  ) {}

  /** Keeps what this run learned. */
  async close(): Promise<void> {
    if (this.changed) await this.store.save(this.remembered);
  }

  async resolve(cwd: string): Promise<DirectoryOutcome> {
    const held = this.outcomes.get(cwd);
    if (held !== undefined) return held;
    const outcome = await this.look(cwd);
    this.outcomes.set(cwd, outcome);
    return outcome;
  }

  private async look(cwd: string): Promise<DirectoryOutcome> {
    const key = cwdKey(cwd, this.caseInsensitiveFileSystem);
    const located = await this.locator.locate(cwd);
    if (located.status === "gone") {
      const earlier = this.remembered.get(key);
      if (earlier === undefined) return { skipped: "never-seen-alive" };
      return this.fromMemory(earlier);
    }
    if (located.status === "outside-repository") return { skipped: "outside-repo" };
    // A repository with no origin and no commit has nothing to be named by.
    const id = repositoryIdOf(located);
    if (id === null) return { skipped: "outside-repo" };
    const consent = await this.consentFor(located.root);
    const resolution = {
      repository_id: id,
      root: located.root,
      consented: consent === "granted",
      clone: located.clone,
    };
    if (!sameResolution(this.remembered.get(key), resolution)) {
      this.remembered.set(key, resolution);
      this.changed = true;
    }
    if (consent === "granted") return { stored: resolution, live: true };
    return { skipped: consent === "unreadable" ? "unreadable-consent" : "no-consent" };
  }

  private async fromMemory(earlier: RepositoryResolution): Promise<DirectoryOutcome> {
    const live = earlier.clone === undefined ? "gone" : await this.cloneConsentFor(earlier.clone);
    if (live === "gone") {
      return earlier.consented ? { stored: earlier, live: false } : { skipped: "no-consent" };
    }
    if (live === "granted") return { stored: earlier, live: false };
    return { skipped: live === "unreadable" ? "unreadable-consent" : "no-consent" };
  }

  private async cloneConsentFor(clone: string): Promise<Consent | "gone"> {
    const held = this.cloneConsents.get(clone);
    if (held !== undefined) return held;
    const reading = await this.consentSource.readClone(clone);
    const consent = reading.kind === "gone" ? "gone" : consentOf(reading);
    this.cloneConsents.set(clone, consent);
    return consent;
  }

  private async consentFor(root: string): Promise<Consent> {
    const held = this.consents.get(root);
    if (held !== undefined) return held;
    const consent = await consentOfRoot(this.consentSource, root);
    this.consents.set(root, consent);
    return consent;
  }
}

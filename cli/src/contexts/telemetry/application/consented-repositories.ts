import type { ConsentSource } from "../domain/ports/consent-source.js";
import type { RepositoryLocator } from "../domain/ports/repository-locator.js";
import { repositoryIdOf } from "../domain/repository-identity.js";
import { consentOfRoot } from "./repository-consent.js";

export type RefusalReason =
  | "environment"
  | "outside-repository"
  | "unidentified-repository"
  | "no-consent"
  | "unreadable-consent";

export type ConsentedRepository =
  | { readonly status: "open"; readonly repositoryId: string; readonly root: string }
  | { readonly status: "refused"; readonly reason: RefusalReason };

/** The repository a directory is in, when its project opted in to this version of
 * measurement. A declaration is stored only for a project that asked to be measured. */
export class ConsentedRepositories {
  constructor(
    private readonly locator: RepositoryLocator,
    private readonly consents: ConsentSource
  ) {}

  async open(cwd: string): Promise<ConsentedRepository> {
    const located = await this.locator.locate(cwd);
    if (located.status !== "repository") return { status: "refused", reason: "outside-repository" };
    const repositoryId = repositoryIdOf(located);
    if (repositoryId === null) return { status: "refused", reason: "unidentified-repository" };
    const consent = await consentOfRoot(this.consents, located.root);
    if (consent === "granted") return { status: "open", repositoryId, root: located.root };
    return {
      status: "refused",
      reason: consent === "unreadable" ? "unreadable-consent" : "no-consent",
    };
  }
}

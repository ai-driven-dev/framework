import type { LocatedDirectory } from "../../domain/resolution/located-directory.js";
import type { ConsentSource } from "../../ports/consent-source.js";
import type { RepositoryLocator } from "../../ports/repository-locator.js";

export type Located = Extract<LocatedDirectory, { status: "repository" }>;

export type CloneConsent =
  | { readonly status: "refused"; readonly reason: "outside-repository" | "unreadable-git-config" }
  | {
      readonly status: "read";
      readonly located: Located;
      /** The value of `aidd.telemetry`, `null` when it is not set. */
      readonly value: string | null;
    };

/** The clone a directory is in, and what its git config says about measuring it. */
export class ReadCloneConsent {
  constructor(
    private readonly locator: RepositoryLocator,
    private readonly consents: ConsentSource
  ) {}

  async execute(cwd: string): Promise<CloneConsent> {
    const located = await this.locator.locate(cwd);
    if (located.status === "unreadable")
      return { status: "refused", reason: "unreadable-git-config" };
    if (located.status !== "repository") return { status: "refused", reason: "outside-repository" };
    const reading = await this.consents.read(located.root);
    if (reading.kind === "unreadable")
      return { status: "refused", reason: "unreadable-git-config" };
    return { status: "read", located, value: reading.value };
  }
}

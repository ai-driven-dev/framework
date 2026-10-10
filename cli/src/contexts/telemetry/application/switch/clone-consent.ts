import type { ConsentSource } from "../../domain/ports/consent-source.js";
import type { LocatedDirectory, RepositoryLocator } from "../../domain/ports/repository-locator.js";

export type CloneConsent =
  | { readonly status: "refused"; readonly reason: "outside-repository" | "unreadable-git-config" }
  | {
      readonly status: "read";
      readonly located: Extract<LocatedDirectory, { status: "repository" }>;
      /** The value of `aidd.telemetry`, `null` when it is not set. */
      readonly value: string | null;
    };

/** The clone a directory is in, and what its git config says about measuring it. */
export async function readCloneConsent(
  locator: RepositoryLocator,
  consents: ConsentSource,
  cwd: string
): Promise<CloneConsent> {
  const located = await locator.locate(cwd);
  if (located.status === "unreadable")
    return { status: "refused", reason: "unreadable-git-config" };
  if (located.status !== "repository") return { status: "refused", reason: "outside-repository" };
  const reading = await consents.read(located.root);
  if (reading.kind === "unreadable") return { status: "refused", reason: "unreadable-git-config" };
  return { status: "read", located, value: reading.value };
}

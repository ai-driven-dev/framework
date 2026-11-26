/** Where a credential is kept: the project's own record comes before the user's. */
export type AuthLevel = "project" | "user";

/** How a credential yields its token: kept in the record, or asked of a named provider. */
export type AuthMethod = "external" | "stored";

/** What a person hands `auth login`: a token to keep, or the provider to ask for one. */
export type Credential =
  | { method: "stored"; token: string }
  | { method: "external"; provider: string };

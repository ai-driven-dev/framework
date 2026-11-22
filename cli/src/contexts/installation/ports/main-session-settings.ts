/** Main-session settings aidd writes, keyed by the tool's own config key. */
export type MainModelValues = Readonly<Record<string, string>>;

/** What aidd wrote, where, and what each key held before, so removal restores it. */
export interface MainModelRecord {
  /** The settings file written, so removal restores that file whatever the environment says. */
  readonly path: string;
  readonly written: MainModelValues;
  readonly previous: Readonly<Record<string, string | null>>;
  /** The settings file did not exist before aidd wrote it. */
  readonly created: boolean;
}

/** What `planInstall` needs: `schema` heads a file this creates. */
export interface MainModelInstall {
  readonly path: string;
  readonly content: string | null;
  readonly values: MainModelValues;
  readonly record: MainModelRecord | undefined;
  readonly schema?: string;
}

/** A settings file aidd leaves as it is, and why. */
export interface MainModelRefusal {
  readonly refused: string;
}

/** Edits a tool's main-session settings file, leaving the rest of it, comments included, as it
 * is. Both plans refuse a file holding no JSON object, so nothing is half-written. */
export interface MainSessionSettings {
  /** Sets `values` in the file at `path`, whose `content` is null when it does not exist yet,
   * recording what each key held before. A key the person changed since aidd wrote it is theirs
   * again. Refuses a key holding no string. `schema` heads a file this creates. */
  planInstall(
    request: MainModelInstall
  ): { readonly content: string; readonly record: MainModelRecord } | MainModelRefusal;
  /** Restores the keys aidd's values still hold, leaving one the person changed. `null` content
   * means the file is to be deleted: aidd created it and it holds nothing else. */
  planRemoval(
    content: string | null,
    record: MainModelRecord
  ): { readonly content: string | null } | MainModelRefusal;
}

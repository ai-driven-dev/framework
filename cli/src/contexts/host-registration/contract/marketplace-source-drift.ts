export type MarketplaceSourceDrift =
  | {
      /** The host already follows a newer build of aidd's own shared source than
       * this run would request — refusing to overwrite it is the rollback refusal:
       * a lower version must never make the host follow it backward. */
      readonly kind: "version-behind";
      readonly registeredVersion: string;
      readonly requestedVersion: string;
    }
  | {
      /** The host still points at this project's own pre-migration, per-project
       * cache rather than the shared, machine-scope one `requestedSource` names. */
      readonly kind: "unmigrated-project-source";
    }
  | {
      /** The host still points at *another* project's own pre-migration cache, discovered from the
       * registered path's own segments alone. A caller that can write `references.json` uses
       * `projectRoot` to record that project's own claim on the shared source. */
      readonly kind: "unmigrated-foreign-project-source";
      readonly projectRoot: string;
    };

/**
 * A version or migration drift decided from the path's own segments — never a different-catalog
 * conflict, so it carries no identity at all.
 */
export interface MarketplaceSourceDriftFound {
  readonly name: string;
  readonly registeredSource: string;
  readonly requestedSource: string;
  readonly location: string;
  readonly drift: MarketplaceSourceDrift;
}

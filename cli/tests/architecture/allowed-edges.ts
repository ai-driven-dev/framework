/** The context edge table: which context may import which, and which contexts Biome holds. */

/** Exactly these edges between contexts, plus every context to shared. Every row is a row of the
 * target context map (target/00-overview.md, section 4); a row that is debt goes in
 * `TRANSITIONAL_PAIRS`. */
export const ALLOWED = new Set([
  "translate->tools",
  // The token a fetch carries (`contract/token-provider.ts`).
  "distribution->auth",
  // The token the changelog fetch carries (`contract/token-provider.ts`).
  "update->auth",
  // Installation reads the installed tools' profiles.
  "installation->tools",
  // The target context map gives host-registration the contract of tools
  // (target/04-tools-and-translate.md, "Others reach tools only through its application/ and
  // contract/"). Biome keeps tools' domain and application out of reach.
  "host-registration->tools",
]);

/**
 * The ALLOWED rows that are debt rather than the target context map, each with the exact
 * `importer -> target` pairs that justify it. A stable row stays edge-level; a transitional one
 * admits these imports and no other, so a new import under an existing row fails instead of
 * riding in. The lists only shrink: a pair the code no longer holds fails until removed.
 */
export const TRANSITIONAL_PAIRS: Readonly<Record<string, readonly string[]>> = {};

/**
 * The contexts whose interior is held by Biome's folder groups instead of the public-surface
 * list in `context-boundary.arch.test.ts`: they publish `contract/` and `application/` and
 * keep the three folders below to themselves and the composition root. The list is data for
 * `generate-biome-boundaries.mjs`, which writes the groups every importer must carry.
 */
export const HELD_BY_BIOME: readonly string[] = [
  "auth",
  "distribution",
  "host-registration",
  "installation",
  "machine-claims",
  "recipes",
  "telemetry",
  "tools",
  "translate",
  "update",
];

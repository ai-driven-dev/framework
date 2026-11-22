/** A bundled config asset, as the asset provider hands it over. */
export type ConfigAsset = Record<string, unknown> | readonly unknown[] | string;

/** The bundled schemas a build validates against. */
export type SchemaName =
  | "plugin-manifest"
  | "marketplace"
  | "claude-marketplace"
  | "codex-marketplace"
  | "codex-plugin-manifest";

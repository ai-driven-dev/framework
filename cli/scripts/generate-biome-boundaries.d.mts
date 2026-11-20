export interface BoundaryInputs {
  readonly contexts: readonly string[];
  readonly allowed: ReadonlySet<string>;
  readonly heldByBiome: readonly string[];
  layersOf(context: string): readonly string[];
  interiorGroupsOf(context: string): readonly string[];
}
export interface RestrictedPattern {
  group?: string[];
  message?: string;
}
export interface BiomeOverride {
  includes?: string[];
  linter?: {
    rules?: {
      style?: {
        noRestrictedImports?: { options?: { patterns?: RestrictedPattern[] } };
      };
    };
  };
}
export interface BiomeConfig {
  overrides?: BiomeOverride[];
}

export function interiorGroupsOf(context: string, contextsDir: string): string[];
export function boundaryInputs(
  srcDir: string,
  table: { allowed: ReadonlySet<string>; heldByBiome: readonly string[] }
): BoundaryInputs;
export function overrideIncludes(context: string, layer: string): string;
export function restrictedImportOptions(
  override: BiomeOverride
): { patterns?: RestrictedPattern[] } | undefined;
export function boundaryOverrides<Config extends BiomeConfig>(
  config: Config,
  input: BoundaryInputs
): Config;

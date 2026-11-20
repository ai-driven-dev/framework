export interface BoundaryInputs {
  readonly contexts: readonly string[];
  /** The contexts with a `tests/contexts/<context>/` folder; absent or empty, no test override is written. */
  readonly testContexts?: readonly string[];
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
        noRestrictedImports?: {
          options?: { paths?: Record<string, string>; patterns?: RestrictedPattern[] };
        };
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
  table: { allowed: ReadonlySet<string>; heldByBiome: readonly string[] },
  testsDir?: string
): BoundaryInputs;
export function overrideIncludes(context: string, layer: string): string;
export function restrictedImportOptions(
  override: BiomeOverride
): { paths?: Record<string, string>; patterns?: RestrictedPattern[] } | undefined;
export function boundaryOverrides<Config extends BiomeConfig>(
  config: Config,
  input: BoundaryInputs
): Config;

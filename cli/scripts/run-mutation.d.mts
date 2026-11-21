export interface MutationScope {
  readonly mutate: string | readonly string[];
  /** The floor the score must hold; a scope without one never fails on its score. */
  readonly break?: number;
  /** CI legs the scope is split into; one when absent. */
  readonly shards?: number;
  /** Test paths whose change runs the scope per change, like its source. */
  readonly tests?: readonly string[];
  /** Run only for a harness file or a full run, never for a change to its own files. */
  readonly harnessOnly?: boolean;
}

export interface MutationReport {
  readonly files?: Readonly<
    Record<
      string,
      {
        readonly mutants: readonly {
          readonly status: string;
          readonly id?: string;
          readonly coveredBy?: readonly string[];
          readonly killedBy?: readonly string[];
          readonly testsCompleted?: number;
          readonly static?: boolean;
          readonly mutatorName?: string;
          readonly location?: { readonly start: { readonly line: number } };
        }[];
      }
    >
  >;
}

export function pruneIncremental<T extends MutationReport>(report: T): T;

export function strykerArgs(
  scope: string,
  scopes: Readonly<Record<string, MutationScope>>,
  options?: { readonly force?: boolean }
): string[];
export function scoreOf(report: MutationReport): number;
export function breakVerdict(score: number, declared: MutationScope): string | null;
export function canarySelectionVerdict(report: MutationReport): string | null;
export function changedRanges(diff: string): string[];
export function changedArgs(ranges: readonly string[]): string[];
export function survivorsOf(report: MutationReport): string[];
export function shardConfig(
  base: Readonly<Record<string, unknown>>,
  shard: { readonly files: readonly string[]; readonly dir: string; readonly tempDirName: string }
): Record<string, unknown>;
export function parseShard(
  text: string | undefined,
  declared: { readonly shards?: number }
): { shard: number; of: number };

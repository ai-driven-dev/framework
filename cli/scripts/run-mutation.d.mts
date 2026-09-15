export interface MutationScope {
  readonly mutate: string | readonly string[];
  readonly break: number;
}

export interface MutationReport {
  readonly files?: Readonly<
    Record<
      string,
      {
        readonly mutants: readonly {
          readonly status: string;
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
export function changedRanges(diff: string): string[];
export function changedArgs(ranges: readonly string[]): string[];
export function survivorsOf(report: MutationReport): string[];

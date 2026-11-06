import type { MutationReport } from "./run-mutation.mjs";

type Mutate = string | readonly string[];
type WeightOf = (path: string) => number;

export function sourceFiles(): string[];
export function linesOf(path: string): number;
export function matchesGlob(glob: string, path: string): boolean;
export function inScope(mutate: Mutate, path: string): boolean;
export function scopeFiles(mutate: Mutate, files: readonly string[]): string[];
export function partition(
  mutate: Mutate,
  files: readonly string[],
  of: number,
  weightOf?: WeightOf
): string[][];
export function shardFiles(
  mutate: Mutate,
  files: readonly string[],
  shard: number,
  of: number,
  weightOf?: WeightOf
): string[];
export function mergeReports(reports: readonly MutationReport[]): Required<MutationReport>;
export function aggregateVerdict(input: {
  readonly mutate: Mutate;
  readonly files: readonly string[];
  readonly of: number;
  readonly shards: readonly {
    readonly manifest: {
      readonly shard: number;
      readonly of: number;
      readonly files: readonly string[];
    };
    readonly report: MutationReport;
  }[];
  readonly weightOf?: WeightOf;
}): string | null;

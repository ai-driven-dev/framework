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
interface MutationShard {
  readonly manifest: {
    readonly shard: number;
    readonly of: number;
    readonly files: readonly string[];
  };
  readonly report: MutationReport;
}
export function mergeReports(shards: readonly MutationShard[]): Required<MutationReport>;
export function aggregateVerdict(input: {
  readonly mutate: Mutate;
  readonly files: readonly string[];
  readonly of: number;
  readonly shards: readonly MutationShard[];
  readonly weightOf?: WeightOf;
}): string | null;

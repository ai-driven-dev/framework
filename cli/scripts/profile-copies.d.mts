export interface JscpdReport {
  readonly duplicates: readonly {
    readonly firstFile: { readonly name: string };
    readonly secondFile: { readonly name: string };
  }[];
}

export const JSCPD_ARGS: readonly string[];
export const BASELINE: readonly {
  readonly pair: string;
  readonly clones: number;
  readonly reason: string;
}[];
export function copiesBetweenProfiles(report: JscpdReport): string[];
export function scan(dir: string, launcher?: string): JscpdReport;
export function compare(
  current: readonly string[],
  baseline?: typeof BASELINE
): { added: string[]; fixed: string[] };

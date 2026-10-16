import { statSync } from "node:fs";
import { BaseSequencer, type TestSpecification } from "vitest/node";

/** The projects a mutation run uses, cheapest first. */
const PROJECT_ORDER = ["unit", "integration"];

type Ordered = Pick<TestSpecification, "moduleId"> & {
  readonly project: Pick<TestSpecification["project"], "name">;
};

function rankOf(project: string): number {
  const rank = PROJECT_ORDER.indexOf(project);
  return rank === -1 ? PROJECT_ORDER.length : rank;
}

/**
 * The order a mutant runs its covering test files in: unit before integration, then the
 * smallest file first, then by path.
 *
 * Stryker stops a mutant at its first failing test, so what a mutant costs is the time spent
 * before the test that kills it. Vitest's own order is the opposite: projects by name, so
 * `integration` before `unit`, then the longest file first. A file's size stands in for its
 * duration because it is the same on every machine and in every sandbox, where no duration
 * cache exists. The order changes which covering test fails first, never which tests run.
 */
export function mutationOrder<T extends Ordered>(
  specs: readonly T[],
  sizeOf: (path: string) => number = (path) => statSync(path).size
): T[] {
  const sizes = new Map(specs.map((spec) => [spec.moduleId, sizeOf(spec.moduleId)]));
  return [...specs].sort(
    (a, b) =>
      rankOf(a.project.name) - rankOf(b.project.name) ||
      (sizes.get(a.moduleId) ?? 0) - (sizes.get(b.moduleId) ?? 0) ||
      (a.moduleId < b.moduleId ? -1 : a.moduleId > b.moduleId ? 1 : 0)
  );
}

export class CheapestKillerFirst extends BaseSequencer {
  override async sort<T extends Ordered>(files: T[]): Promise<T[]> {
    return mutationOrder(files);
  }
}

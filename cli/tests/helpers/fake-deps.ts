import type { Deps, DepsFactory, MenuDeps, MenuDepsFactory } from "../../src/presentation/deps.js";

/**
 * A `DepsFactory` over a graph holding only the members a command reads. `object` is the one
 * type both the partial graph and `Deps` share, so the narrowing is a downcast the compiler
 * accepts, and a member the command never touches is never built.
 */
export function asDepsFactory(
  build: (...args: Parameters<DepsFactory>) => Promise<object>
): DepsFactory {
  return async (...args) => (await build(...args)) as Deps;
}

/** The menu's counterpart of `asDepsFactory`. */
export function asMenuDepsFactory(build: (projectRoot: string) => object): MenuDepsFactory {
  return (projectRoot) => build(projectRoot) as MenuDeps;
}

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface StubPnpm {
  /** The environment to run with: the stub directory comes first on `PATH`, so it wins over any real pnpm. */
  readonly env: NodeJS.ProcessEnv;
  dispose(): Promise<void>;
}

/** Answers `add --prefix P -- SPEC`
 * for the one package it serves and nothing else: any other argv shape or package fails. */
function pnpmScript(served: string): string {
  return `#!/bin/sh
[ "$1" = add ] && [ "$2" = --prefix ] && [ "$4" = -- ] && [ "$#" = 5 ] || { echo "unexpected argv: $*" >&2; exit 2; }
spec="$5"
name="\${spec%@*}"
case "$name" in
  ${served}|-*) mkdir -p "$3/node_modules/$name" ;;
  *) echo "ERR_PNPM_FETCH_404 $name" >&2; exit 1 ;;
esac
`;
}

/** A `pnpm` that is a script in a temp directory placed first on `PATH`. */
export async function aStubPnpm(servedPackage: string): Promise<StubPnpm> {
  const dir = await mkdtemp(join(tmpdir(), "aidd-stub-pnpm-"));
  await writeFile(join(dir, "pnpm"), pnpmScript(servedPackage), { mode: 0o755 });
  return {
    env: { PATH: `${dir}:/usr/bin:/bin` },
    dispose: () => rm(dir, { recursive: true, force: true }),
  };
}

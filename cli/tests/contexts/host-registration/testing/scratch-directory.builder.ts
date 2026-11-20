import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** A fresh directory under the temp root, named so the stale-directory sweep reclaims it. */
export async function scratchDirectory(): Promise<{ dir: string; dispose(): Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), "aidd-host-registration-"));
  return { dir, dispose: () => rm(dir, { recursive: true, force: true }) };
}

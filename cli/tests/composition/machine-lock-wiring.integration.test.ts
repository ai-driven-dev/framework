import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { heldByMachineLock } from "../../src/composition/contexts/machine-claims.js";

describe("the user scope held by the machine lock", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "aidd-machine-lock-wiring-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("holds the lock beside the repository's file while an action runs, and only then", async () => {
    const path = join(dir, "manifest.json");
    const repository = heldByMachineLock({ path });

    const heldDuring = await repository.withExclusiveAccess(async () => existsSync(`${path}.lock`));

    expect(heldDuring).toBe(true);
    expect(existsSync(`${path}.lock`)).toBe(false);
  });
});

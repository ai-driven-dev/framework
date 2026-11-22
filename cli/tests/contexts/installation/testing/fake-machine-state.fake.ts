import type { MachineStatePurge } from "../../../../src/contexts/installation/ports/user-scope-purge.js";

/** Machine state told as built versions, counting each purge. */
export class FakeMachineState implements MachineStatePurge {
  purgeCount = 0;

  constructor(private readonly versions: readonly string[] = []) {}

  async builtVersions(): Promise<readonly string[]> {
    return this.versions;
  }

  async purge(): Promise<void> {
    this.purgeCount += 1;
  }
}

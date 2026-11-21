import type { MachineStatePurge } from "../../../../src/contexts/installation/ports/machine-state-purge.js";

/** Machine state told as built versions, recording each purge and the root it was asked with. */
export class FakeMachineStatePurge implements MachineStatePurge {
  readonly purgedRoots: string[] = [];

  constructor(private readonly versions: readonly string[] = []) {}

  async builtVersions(): Promise<readonly string[]> {
    return this.versions;
  }

  async purge(projectRoot: string): Promise<void> {
    this.purgedRoots.push(projectRoot);
  }
}

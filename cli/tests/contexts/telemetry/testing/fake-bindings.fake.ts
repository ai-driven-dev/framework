import type { BranchConfigBinding } from "../../../../src/contexts/telemetry/domain/branch-binding.js";
import type { BranchBindingSource } from "../../../../src/contexts/telemetry/ports/branch-binding-source.js";

export class FakeBindings implements BranchBindingSource {
  bindingsByRoot = new Map<string, BranchConfigBinding[]>();
  creation = new Map<string, string | null>();
  reflogReads = 0;
  /** Pass one array to several fakes to see the order they were used in. */
  constructor(readonly events: string[] = []) {}

  async bindings(root: string): Promise<readonly BranchConfigBinding[]> {
    this.events.push("read-config");
    return this.bindingsByRoot.get(root) ?? [];
  }

  async createdAt(_root: string, branch: string): Promise<string | null> {
    this.reflogReads += 1;
    return this.creation.get(branch) ?? null;
  }
}

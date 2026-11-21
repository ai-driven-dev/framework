import type {
  ClaimedHostRef,
  HostWithdrawal,
} from "../../../../src/contexts/installation/ports/native-host.js";

/** A host withdrawal whose proof is the ref it proved: it records each proof and each uninstall. */
export class FakeHostWithdrawal
  implements Pick<HostWithdrawal<string>, "proveClaimedRef" | "uninstallProven">
{
  readonly proved: ClaimedHostRef[] = [];
  readonly uninstalled: string[] = [];

  async proveClaimedRef(_registrations: unknown, claim: ClaimedHostRef): Promise<string> {
    this.proved.push(claim);
    return claim.ref;
  }

  async uninstallProven(proof: string): Promise<void> {
    this.uninstalled.push(proof);
  }
}

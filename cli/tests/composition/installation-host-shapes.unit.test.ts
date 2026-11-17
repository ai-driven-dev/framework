import { describe, expectTypeOf, it } from "vitest";
import type {
  ClaimedHostRef as HostClaimedHostRef,
  ProjectSourceCommand as HostProjectSourceCommand,
  WithdrawFromHostCommand as HostWithdrawFromHostCommand,
} from "../../src/contexts/host-registration/application/withdraw-from-host.js";
import type {
  ClaimedHostRef,
  ProjectSourceCommand,
  WithdrawFromHostCommand,
} from "../../src/contexts/installation/ports/native-host.js";

// Composition hands the host registration's objects to installation's ports. Method parameters
// are compared bivariantly there, so these assertions are what holds the two shapes together.
describe("the withdrawal installation hands over", () => {
  it("is accepted by the host registration", () => {
    expectTypeOf<WithdrawFromHostCommand>().toExtend<HostWithdrawFromHostCommand>();
    expectTypeOf<ProjectSourceCommand>().toExtend<HostProjectSourceCommand>();
    expectTypeOf<ClaimedHostRef>().toExtend<HostClaimedHostRef>();
  });
});

import { describe, expectTypeOf, it } from "vitest";
import type {
  RegisterPluginWithHostCommand as HostRegisterPluginWithHostCommand,
  RegisterPluginWithHostResult as HostRegisterPluginWithHostResult,
  RegistrationSubject as HostRegistrationSubject,
} from "../../src/contexts/host-registration/application/register-plugin-with-host.js";
import type {
  ClaimedHostRef as HostClaimedHostRef,
  ProjectSourceCommand as HostProjectSourceCommand,
  WithdrawFromHostCommand as HostWithdrawFromHostCommand,
} from "../../src/contexts/host-registration/application/withdraw-from-host.js";
import type { NativeMarketplaceSource as HostNativeMarketplaceSource } from "../../src/contexts/host-registration/domain/native-marketplace-source.js";
import type { RegistrationRecord as HostRegistrationRecord } from "../../src/contexts/host-registration/domain/registration-record.js";
import type {
  NativeMarketplaceSource,
  RegistrationRecord,
} from "../../src/contexts/installation/domain/manifest/native-registrations.js";
import type {
  ClaimedHostRef,
  ProjectSourceCommand,
  RegisterPluginWithHostCommand,
  RegisterPluginWithHostResult,
  RegistrationSubject,
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

describe("the registration installation asks for", () => {
  it("is accepted by the host registration, whatever marketplace subject it carries", () => {
    expectTypeOf<RegisterPluginWithHostCommand<RegistrationSubject>>().toExtend<
      HostRegisterPluginWithHostCommand<HostRegistrationSubject>
    >();
  });

  it("is answered in terms installation reads", () => {
    expectTypeOf<HostRegisterPluginWithHostResult>().toExtend<RegisterPluginWithHostResult>();
  });
});

describe("the record installation keeps of a registration", () => {
  it("holds what the host registration records, and nothing it would not", () => {
    expectTypeOf<RegistrationRecord>().toEqualTypeOf<HostRegistrationRecord>();
    expectTypeOf<NativeMarketplaceSource>().toEqualTypeOf<HostNativeMarketplaceSource>();
  });
});

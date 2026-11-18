import { describe, expectTypeOf, it } from "vitest";
import type { NativeHostRegistrationGate } from "../../src/contexts/host-registration/application/native-host-registration-gate.js";
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
import type {
  afterActivation,
  claimsOnMarketplace,
  RegistrationRecord as HostRegistrationRecord,
  isQualifiedRef,
  marketplaceOf,
  mergeCatalogueClaims,
  pluginRefsOf,
  refOf,
  refOnAnyHost,
  refOnHostName,
  refSelectedBy,
  refsOnHosts,
  registrationPreview,
  withoutClaimedRef,
  withoutMarketplace,
  withoutRef,
} from "../../src/contexts/host-registration/domain/registration-record.js";
import type { PluginRemovalClaims } from "../../src/contexts/installation/application/removal/remove-plugin.js";
import type {
  NativeMarketplaceSource,
  RegistrationRecord,
} from "../../src/contexts/installation/domain/manifest/native-registrations.js";
import type {
  ClaimedHostRef,
  MarketplaceRemovalPlanner,
  ProjectSourceCommand,
  RegisterPluginWithHostCommand,
  RegisterPluginWithHostResult,
  RegistrationRecordRules,
  RegistrationSubject,
  WithdrawFromHostCommand,
} from "../../src/contexts/installation/ports/native-host.js";
import type { pluginRemovalClaims } from "../../src/contexts/machine-claims/application/plugin-removal-claims.js";

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

describe("the rules installation asks of the host registration over a record", () => {
  it("are the host registration's own functions, member for member", () => {
    expectTypeOf<RegistrationRecordRules["pluginRefsOf"]>().toEqualTypeOf<typeof pluginRefsOf>();
    expectTypeOf<RegistrationRecordRules["refOf"]>().toEqualTypeOf<typeof refOf>();
    expectTypeOf<RegistrationRecordRules["refsOnHosts"]>().toEqualTypeOf<typeof refsOnHosts>();
    expectTypeOf<RegistrationRecordRules["marketplaceOf"]>().toEqualTypeOf<typeof marketplaceOf>();
    expectTypeOf<RegistrationRecordRules["claimsOnMarketplace"]>().toEqualTypeOf<
      typeof claimsOnMarketplace
    >();
    expectTypeOf<RegistrationRecordRules["refOnHostName"]>().toEqualTypeOf<typeof refOnHostName>();
    expectTypeOf<RegistrationRecordRules["refOnAnyHost"]>().toEqualTypeOf<typeof refOnAnyHost>();
    expectTypeOf<RegistrationRecordRules["isQualifiedRef"]>().toEqualTypeOf<
      typeof isQualifiedRef
    >();
    expectTypeOf<RegistrationRecordRules["refSelectedBy"]>().toEqualTypeOf<typeof refSelectedBy>();
    expectTypeOf<RegistrationRecordRules["registrationPreview"]>().toEqualTypeOf<
      typeof registrationPreview
    >();
    expectTypeOf<RegistrationRecordRules["withoutRef"]>().toEqualTypeOf<typeof withoutRef>();
    expectTypeOf<RegistrationRecordRules["withoutClaimedRef"]>().toEqualTypeOf<
      typeof withoutClaimedRef
    >();
    expectTypeOf<RegistrationRecordRules["withoutMarketplace"]>().toEqualTypeOf<
      typeof withoutMarketplace
    >();
    expectTypeOf<RegistrationRecordRules["afterActivation"]>().toEqualTypeOf<
      typeof afterActivation
    >();
    expectTypeOf<RegistrationRecordRules["mergeCatalogueClaims"]>().toEqualTypeOf<
      typeof mergeCatalogueClaims
    >();
  });
});

describe("the tool installation hands to the host and to the machine claims", () => {
  type MachineClaims = ReturnType<typeof pluginRemovalClaims>;

  it("is accepted by the catalogue removal plan", () => {
    expectTypeOf<Parameters<MarketplaceRemovalPlanner["planMarketplaceRemoval"]>[0]>().toExtend<
      Parameters<NativeHostRegistrationGate["planMarketplaceRemoval"]>[0]
    >();
  });

  it("is accepted by the guard on a ref another project needs", () => {
    expectTypeOf<Parameters<PluginRemovalClaims["guardMessage"]>[1]>().toExtend<
      Parameters<MachineClaims["guardMessage"]>[1]
    >();
  });

  it("is accepted by the proof of the files safe to delete", () => {
    expectTypeOf<Parameters<PluginRemovalClaims["userFilesSafeToDelete"]>[1]>().toExtend<
      Parameters<MachineClaims["userFilesSafeToDelete"]>[1]
    >();
  });
});

import { describe, expectTypeOf, it } from "vitest";
import type { NativeMarketplaceSource as HostNativeMarketplaceSource } from "../../src/contexts/host-registration/domain/native-marketplace-source.js";
import type { RegistrationRecord as HostRegistrationRecord } from "../../src/contexts/host-registration/domain/registration-record.js";
import type {
  NativeMarketplaceSource,
  RegistrationRecord,
} from "../../src/contexts/installation/domain/manifest/native-registrations.js";

// Installation's host ports are function-typed members, so composition checks each function a host
// hands over strictly. A field the host adds as optional is accepted both ways and the manifest
// would drop it silently, which composition cannot see: this is what holds the two copies equal.
describe("the record installation keeps of a registration", () => {
  it("holds what the host registration records, and nothing it would not", () => {
    expectTypeOf<RegistrationRecord>().toEqualTypeOf<HostRegistrationRecord>();
    expectTypeOf<NativeMarketplaceSource>().toEqualTypeOf<HostNativeMarketplaceSource>();
  });
});

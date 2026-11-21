import { describe, expect, it } from "vitest";
import { CheckIdentity } from "../../../../../src/contexts/telemetry/application/identity/check-identity.use-case.js";
import { CheckTelemetryOn } from "../../../../../src/contexts/telemetry/application/switch/check-telemetry-on.use-case.js";
import {
  ConflictingIdentityFlagsError,
  InvalidIdentityError,
} from "../../../../../src/contexts/telemetry/domain/telemetry.error.js";
import { InputRequiredError } from "../../../../../src/shared/domain/shared.error.js";

const check = new CheckTelemetryOn(new CheckIdentity());
const GIVEN = { yes: true, anonymous: false, interactive: true };

describe("CheckTelemetryOn", () => {
  it("accepts a request that can be answered", () => {
    expect(() => check.execute({ ...GIVEN, as: "Ada Example" })).not.toThrow();
    expect(() => check.execute({ ...GIVEN, yes: false })).not.toThrow();
  });

  it("refuses --as with --anonymous", () => {
    expect(() => check.execute({ ...GIVEN, as: "Ada Example", anonymous: true })).toThrow(
      new ConflictingIdentityFlagsError()
    );
  });

  it("refuses an identifier that cannot name a person", () => {
    expect(() => check.execute({ ...GIVEN, as: "a".repeat(129) })).toThrow(
      new InvalidIdentityError()
    );
  });

  it("refuses to ask where nobody can be asked, unless --yes", () => {
    expect(() => check.execute({ ...GIVEN, yes: false, interactive: false })).toThrow(
      new InputRequiredError(
        "Nothing to ask in a non-interactive run: pass --yes to turn measurement on."
      )
    );
    expect(() => check.execute({ ...GIVEN, interactive: false })).not.toThrow();
  });
});

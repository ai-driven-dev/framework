import { describe, expect, it } from "vitest";
import { ParseIdentityFlags } from "../../../../../src/contexts/telemetry/application/identity/parse-identity-flags.use-case.js";
import { IdentityOffWithIdentifierError } from "../../../../../src/contexts/telemetry/contract/errors/telemetry.error.js";

const resolve = new ParseIdentityFlags();

describe("reading the identity flags", () => {
  it("shows the identity when nothing is typed", () => {
    expect(resolve.execute({ off: false, id: undefined })).toEqual({ action: "show" });
  });

  it("sets the identity to what was typed", () => {
    expect(resolve.execute({ off: false, id: "ada" })).toEqual({ action: "set", typed: "ada" });
  });

  it("removes the identity", () => {
    expect(resolve.execute({ off: true, id: undefined })).toEqual({ action: "off" });
  });

  it("refuses an identifier given with --off", () => {
    expect(() => resolve.execute({ off: true, id: "ada" })).toThrow(
      new IdentityOffWithIdentifierError()
    );
  });
});

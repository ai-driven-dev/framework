import { describe, expect, it } from "vitest";
import { throwRefusal } from "../../../../src/contexts/host-registration/application/throw-refusal.js";
import { NativePluginCliError } from "../../../../src/contexts/host-registration/domain/host-registration.error.js";

describe("throwRefusal", () => {
  it("lets a call the host accepted pass", () => {
    expect(() => throwRefusal(undefined)).not.toThrow();
  });

  it("throws the refusal as the typed error carrying the host's reason", () => {
    expect(() => throwRefusal({ detail: "exit 1" })).toThrow(new NativePluginCliError("exit 1"));
  });
});

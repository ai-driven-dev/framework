import { describe, expect, it } from "vitest";
import { UnsupportedManifestVersionError } from "../../../../../src/contexts/installation/domain/installation.error.js";
import {
  assertSupportedManifestVersion,
  DEFAULT_MANIFEST_CONTEXT,
} from "../../../../../src/contexts/installation/domain/manifest/assert-supported-version.js";
import { MANIFEST_VERSION } from "../../../../../src/contexts/installation/domain/manifest-serialization.js";

function refusal(
  version: unknown,
  context = DEFAULT_MANIFEST_CONTEXT
): UnsupportedManifestVersionError {
  try {
    assertSupportedManifestVersion({ version }, context);
  } catch (error) {
    if (error instanceof UnsupportedManifestVersionError) return error;
    throw error;
  }
  throw new Error("expected a refusal");
}

describe("reading a manifest of some version", () => {
  it("accepts the version this CLI reads", () => {
    expect(() =>
      assertSupportedManifestVersion({ version: MANIFEST_VERSION }, DEFAULT_MANIFEST_CONTEXT)
    ).not.toThrow();
  });

  it("tells a newer document apart, to be answered by updating the CLI", () => {
    expect(refusal(MANIFEST_VERSION + 1)).toMatchObject({ reinstall: undefined });
  });

  it("carries the file and the scope from the context for an older document", () => {
    const error = refusal(MANIFEST_VERSION - 1, {
      path: "~/.aidd/manifest.json",
      location: "on this machine",
      scope: "user",
    });

    expect(error.reinstall).toBe("user");
    expect(error.detail).toContain("~/.aidd/manifest.json on this machine");
  });

  it("singles out a version 6 document, the only one a published CLI can still clean", () => {
    expect(refusal(6).detail).toContain("5.2.2");
    expect(refusal(5).detail).not.toContain("5.2.2");
  });
});

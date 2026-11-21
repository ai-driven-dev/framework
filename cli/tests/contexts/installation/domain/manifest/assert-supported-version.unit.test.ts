import { describe, expect, it } from "vitest";
import { InvalidManifestDataError } from "../../../../../src/contexts/installation/domain/installation.error.js";
import {
  assertSupportedManifestVersion,
  DEFAULT_MANIFEST_CONTEXT,
} from "../../../../../src/contexts/installation/domain/manifest/assert-supported-version.js";
import { MANIFEST_VERSION } from "../../../../../src/contexts/installation/domain/manifest-serialization.js";

function refusal(version: unknown, context = DEFAULT_MANIFEST_CONTEXT): string {
  try {
    assertSupportedManifestVersion({ version }, context);
  } catch (error) {
    if (error instanceof InvalidManifestDataError) return error.detail ?? "";
    throw error;
  }
  throw new Error("expected a refusal");
}

describe("assertSupportedManifestVersion", () => {
  it("accepts the version this CLI reads", () => {
    expect(() =>
      assertSupportedManifestVersion({ version: MANIFEST_VERSION }, DEFAULT_MANIFEST_CONTEXT)
    ).not.toThrow();
  });

  it("tells a newer document to update the CLI", () => {
    expect(refusal(MANIFEST_VERSION + 1)).toContain("Run `aidd update`");
  });

  it("names the file and reinstall command from the context for an older document", () => {
    const message = refusal(MANIFEST_VERSION - 1, {
      path: "~/.aidd/manifest.json",
      location: "on this machine",
      reinstallCommand: "aidd setup --global",
    });

    expect(message).toContain("delete ~/.aidd/manifest.json on this machine");
    expect(message).toContain("`aidd setup --global`");
  });

  it("offers the published clean remedy for a version 6 document only", () => {
    expect(refusal(6)).toContain("clean --force");
    expect(refusal(5)).not.toContain("clean --force");
  });
});

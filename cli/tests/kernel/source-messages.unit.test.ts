import { describe, expect, it } from "vitest";
import { InvalidPluginSourceError } from "../../src/kernel/errors.js";
import {
  parsePluginSource,
  parsePluginSourceShorthand,
  serializePluginSource,
} from "../../src/kernel/source.js";

describe("what a refused source is told", () => {
  it.each([
    [{ kind: "github", repo: "not-a-repo" }, '"repo" must match owner/repo format.'],
    [{ kind: "url" }, '"url" must be a non-empty string.'],
    [{ kind: "git-subdir", path: "p" }, '"url" must be a non-empty string.'],
    [{ kind: "git-subdir", url: "u" }, '"path" must be a non-empty string.'],
    [{ kind: "npm" }, '"package" must be a non-empty string.'],
    [
      { kind: "npm", package: "My-Plugin" },
      '"package" must be a valid npm package name (e.g. my-plugin or @scope/my-plugin). Got: "My-Plugin"',
    ],
    [
      { kind: "npm", package: "my-plugin!" },
      '"package" must be a valid npm package name (e.g. my-plugin or @scope/my-plugin). Got: "my-plugin!"',
    ],
    [
      { kind: "github", repo: "owner/repo", sha: "a".repeat(41) },
      '"sha" must be a 40-character lowercase hex string.',
    ],
    [42, "expected an object."],
    ["github:owner/repo", 'string source "github:owner/repo" is not a recognized path or repo.'],
  ])("refuses %j saying: %s", (raw, detail) => {
    expect(() => parsePluginSource(raw)).toThrow(new InvalidPluginSourceError(detail));
  });
});

describe("what a parsed source carries, field by field", () => {
  it("records no ref on a gitlab shorthand given none", () => {
    expect(parsePluginSourceShorthand("gitlab:my-org/my-plugin")).toStrictEqual({
      kind: "url",
      url: "https://gitlab.com/my-org/my-plugin.git",
    });
  });

  it("serializes a minimal url source with no absent field", () => {
    expect(serializePluginSource({ kind: "url", url: "https://x/p.git" })).toStrictEqual({
      kind: "url",
      url: "https://x/p.git",
    });
  });

  it("serializes a minimal git-subdir source with no absent field", () => {
    expect(
      serializePluginSource({ kind: "git-subdir", url: "https://x/r.git", path: "pkg" })
    ).toStrictEqual({ kind: "git-subdir", url: "https://x/r.git", path: "pkg" });
  });

  it("serializes a minimal npm source with no absent field", () => {
    expect(serializePluginSource({ kind: "npm", package: "pkg" })).toStrictEqual({
      kind: "npm",
      package: "pkg",
    });
  });
});

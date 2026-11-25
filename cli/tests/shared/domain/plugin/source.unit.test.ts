import { describe, expect, it } from "vitest";
import { describePluginSource } from "../../../../src/shared/domain/plugin/source.js";

/** A wrong line here tells the user their project points somewhere it does not. */
describe("the source shown back to a user", () => {
  it("shows a github source as its full URL", () => {
    expect(describePluginSource({ kind: "github", repo: "owner/repo" })).toBe(
      "https://github.com/owner/repo"
    );
  });

  it("appends the ref when the source is pinned", () => {
    expect(describePluginSource({ kind: "github", repo: "owner/repo", ref: "v1" })).toBe(
      "https://github.com/owner/repo@v1"
    );
  });

  it("shows a url source as the URL itself", () => {
    expect(describePluginSource({ kind: "url", url: "https://example.com/p.git" })).toBe(
      "https://example.com/p.git"
    );
  });

  it("shows a git-subdir source as the URL and the path it points into", () => {
    expect(
      describePluginSource({ kind: "git-subdir", url: "https://example.com/r.git", path: "pkg/a" })
    ).toBe("https://example.com/r.git#pkg/a");
  });

  it("shows an npm source with its registry prefix", () => {
    expect(describePluginSource({ kind: "npm", package: "@scope/pkg" })).toBe("npm:@scope/pkg");
  });

  it("appends the version when the npm source has one", () => {
    expect(describePluginSource({ kind: "npm", package: "@scope/pkg", version: "2.1.0" })).toBe(
      "npm:@scope/pkg@2.1.0"
    );
  });

  it("shows a local source as the path itself", () => {
    expect(describePluginSource({ kind: "local", path: "./plugins/mine" })).toBe("./plugins/mine");
  });
});

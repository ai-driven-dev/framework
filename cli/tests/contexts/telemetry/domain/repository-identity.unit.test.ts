import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  normaliseRemote,
  repositoryIdOf,
} from "../../../../src/contexts/telemetry/domain/repository-identity.js";

const CANONICAL = "github.com/acme/widgets";

describe("a remote is reduced to host/owner/repo", () => {
  it.each([
    ["https", "https://github.com/acme/widgets"],
    ["https with .git", "https://github.com/acme/widgets.git"],
    ["https with trailing slash", "https://github.com/acme/widgets/"],
    ["https with .git and slash", "https://github.com/acme/widgets.git/"],
    ["credentials", "https://user:s3cret@github.com/acme/widgets.git"],
    ["token only", "https://ghp_abc@github.com/acme/widgets"],
    ["upper-case host", "https://GitHub.COM/acme/widgets"],
    ["http", "http://github.com/acme/widgets"],
    ["scp-like", "git@github.com:acme/widgets.git"],
    ["scp-like without user", "github.com:acme/widgets"],
    ["scp-like upper-case host", "git@GITHUB.com:acme/widgets.git"],
    ["ssh://", "ssh://git@github.com/acme/widgets.git"],
    ["ssh:// with a port", "ssh://git@github.com:2222/acme/widgets.git"],
    ["git://", "git://github.com/acme/widgets.git"],
    ["surrounding whitespace", "  https://github.com/acme/widgets.git\n"],
    ["several slashes before the path", "https://github.com//acme/widgets"],
    ["several slashes after the path", "https://github.com/acme/widgets//"],
    ["several slashes after .git", "https://github.com/acme/widgets.git//"],
  ])("%s gives one spelling", (_name, url) => {
    expect(normaliseRemote(url)).toBe(CANONICAL);
  });

  it("strips .git only at the end of the path", () => {
    expect(normaliseRemote("https://github.com/acme/site.github.io")).toBe(
      "github.com/acme/site.github.io"
    );
    expect(normaliseRemote("git@github.com:acme/site.github.io.git")).toBe(
      "github.com/acme/site.github.io"
    );
  });

  it("reads an scp-like address whose path mentions a scheme as scp-like", () => {
    expect(normaliseRemote("git@github.com:acme/wid://gets.git")).toBe(
      "github.com/acme/wid://gets"
    );
  });

  it("keeps a sub-group path whole", () => {
    expect(normaliseRemote("git@gitlab.com:group/sub/project.git")).toBe(
      "gitlab.com/group/sub/project"
    );
  });

  it("keeps the case of the path: only the host is case-folded", () => {
    expect(normaliseRemote("https://github.com/Acme/Widgets")).toBe("github.com/Acme/Widgets");
  });

  it.each([
    ["a local path", "/srv/git/widgets.git"],
    ["a relative path", "../widgets"],
    ["a file url", "file:///srv/git/widgets.git"],
    ["a windows drive path", "C:\\work\\widgets"],
    ["a windows drive path with slashes", "C:/work/widgets"],
    ["a host without a path", "https://github.com"],
    ["a host with one segment", "https://github.com/widgets"],
    ["an empty string", ""],
    ["text that is no remote", "not a url"],
    ["text with a colon after other words", "not a url:with/colon"],
    ["a scheme with no host", "https://"],
    ["an scp-like host with one segment", "git@github.com:widgets"],
    ["an scp-like host with no path", "git@github.com:"],
  ])("%s is no identity", (_name, url) => {
    expect(normaliseRemote(url)).toBeNull();
  });
});

describe("a repository id", () => {
  const sha = (text: string): string => createHash("sha256").update(text).digest("hex");

  it("is the sha256 of the normalised remote, whatever its spelling", () => {
    const a = repositoryIdOf({ remote: "git@github.com:acme/widgets.git", rootCommit: "c0ffee" });
    const b = repositoryIdOf({ remote: "https://u:p@GitHub.com/acme/widgets", rootCommit: "beef" });
    expect(a).toBe(sha(CANONICAL));
    expect(b).toBe(a);
  });

  it("never contains the remote it came from", () => {
    const id = repositoryIdOf({ remote: "https://u:p@github.com/acme/widgets", rootCommit: null });
    expect(id).not.toContain("acme");
    expect(id).toMatch(/^[0-9a-f]{64}$/);
  });

  it("falls back to the root commit when there is no origin", () => {
    expect(repositoryIdOf({ remote: null, rootCommit: "abc123" })).toBe("abc123");
  });

  it("falls back to the root commit when the origin is a local path", () => {
    expect(repositoryIdOf({ remote: "/srv/git/widgets.git", rootCommit: "abc123" })).toBe("abc123");
  });

  it("is none when there is neither", () => {
    expect(repositoryIdOf({ remote: null, rootCommit: null })).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  basename,
  dedupePathSegments,
  homeNamed,
  isStrictlyWithin,
  isWithin,
  pathContainsOrEquals,
  pathsOverlap,
  posixRelative,
  samePath,
  samePathSegment,
} from "../../../src/shared/domain/paths.model.js";

describe("comparing two path segments across platforms", () => {
  it("tells two different names apart on win32 too", () => {
    expect(samePathSegment("alpha", "beta", "win32")).toBe(false);
  });
});

describe("comparing two paths", () => {
  it("calls a realpath answer and a stored path the same directory when only separators differ", () => {
    expect(samePath("/user-cache/built/1.0.0", "\\user-cache\\built\\1.0.0", "win32")).toBe(true);
  });

  it("still tells two different directories apart", () => {
    expect(samePath("/user-cache/built/1.0.0", "\\user-cache\\built\\2.0.0", "win32")).toBe(false);
  });

  it("folds case where the filesystem does, and nowhere else", () => {
    expect(samePath("/Cache/Built", "/cache/built", "win32")).toBe(true);
    expect(samePath("/Cache/Built", "/cache/built", "linux")).toBe(false);
  });

  it("leaves a posix path that legitimately holds a backslash alone on posix", () => {
    expect(samePath("/odd/a", "/odd\\a", "linux")).toBe(false);
  });
});

// Asked with backslash-spelled paths, which is what a Windows run passes and what a
// hardcoded "/" comparison never recognises.
describe("asking whether a path contains another", () => {
  it("sees the same directory spelled either way", () => {
    expect(pathContainsOrEquals("/a/b", "/a/b")).toBe(true);
    expect(pathContainsOrEquals("C:\\a\\b", "C:\\a\\b")).toBe(true);
  });

  it("sees a directory inside another, with either separator", () => {
    expect(pathContainsOrEquals("/a", "/a/b/c")).toBe(true);
    expect(pathContainsOrEquals("C:\\a", "C:\\a\\b\\c")).toBe(true);
  });

  it("does not mistake a shared name prefix for containment", () => {
    expect(pathContainsOrEquals("/a/build", "/a/build-cache")).toBe(false);
    expect(pathContainsOrEquals("C:\\a\\build", "C:\\a\\build-cache")).toBe(false);
  });

  it("answers in one direction only", () => {
    expect(pathContainsOrEquals("/a/b/c", "/a")).toBe(false);
    expect(pathContainsOrEquals("C:\\a\\b\\c", "C:\\a")).toBe(false);
  });

  it("separates unrelated directories", () => {
    expect(pathContainsOrEquals("/a", "/b")).toBe(false);
    expect(pathContainsOrEquals("C:\\a", "D:\\a")).toBe(false);
  });
});

describe("asking whether two paths overlap", () => {
  it("answers in both directions, with either separator", () => {
    expect(pathsOverlap("/a", "/a/b")).toBe(true);
    expect(pathsOverlap("/a/b", "/a")).toBe(true);
    expect(pathsOverlap("C:\\a", "C:\\a\\b")).toBe(true);
    expect(pathsOverlap("C:\\a\\b", "C:\\a")).toBe(true);
  });

  it("leaves genuinely separate trees alone", () => {
    expect(pathsOverlap("/a", "/b")).toBe(false);
    expect(pathsOverlap("C:\\src", "C:\\out")).toBe(false);
  });
});

describe("comparing path segments by platform case rules", () => {
  it("compares case-sensitively on a case-sensitive platform", () => {
    expect(samePathSegment("aidd-framework", "AIDD-FRAMEWORK", "linux")).toBe(false);
  });

  it("compares case-insensitively on win32", () => {
    expect(samePathSegment("aidd-framework", "AIDD-FRAMEWORK", "win32")).toBe(true);
  });
});

describe("removing repeated path segments", () => {
  it("collapses a win32 case-only spelling difference, keeping the first spelling", () => {
    expect(dedupePathSegments(["/A/proj", "/a/proj"], "win32")).toEqual(["/A/proj"]);
  });

  it("keeps both spellings on a case-sensitive platform", () => {
    expect(dedupePathSegments(["/A/proj", "/a/proj"], "linux")).toEqual(["/A/proj", "/a/proj"]);
  });
});

describe("spelling a relative path with forward slashes", () => {
  it("spells a Windows-joined path with forward slashes, the form a manifest records", () => {
    expect(posixRelative("C:\\proj\\plugin", "C:\\proj\\plugin\\hooks\\check.sh", "win32")).toBe(
      "hooks/check.sh"
    );
  });

  it("leaves a POSIX path as it is", () => {
    expect(posixRelative("/proj/plugin", "/proj/plugin/skills/commit/SKILL.md", "linux")).toBe(
      "skills/commit/SKILL.md"
    );
  });

  it("answers an empty string for the base itself", () => {
    expect(posixRelative("C:\\proj", "C:\\proj", "win32")).toBe("");
  });
});

describe("naming a path from the home", () => {
  it("names a directory below a Windows home the way a person writes it", () => {
    expect(homeNamed("C:\\Users\\u", "C:\\Users\\u\\.codex", "win32")).toBe("~/.codex");
  });
});

const BOUNDARY = "/home/dev/.cursor/plugins/local";

describe("checking a path stays strictly inside a boundary", () => {
  it("accepts a plugin's own subdirectory inside the boundary", () => {
    expect(isStrictlyWithin(`${BOUNDARY}/aidd-context/skills/hello.md`, BOUNDARY)).toBe(true);
  });

  it("rejects a manifest entry whose `..` segments resolve outside the boundary", () => {
    // What a real `realpath` returns for `${BOUNDARY}/aidd-context/../../../.ssh/id_rsa` -
    // this function trusts its caller already resolved the path, it only compares.
    const escapedViaDotDot = "/home/dev/.ssh/id_rsa";
    expect(isStrictlyWithin(escapedViaDotDot, BOUNDARY)).toBe(false);
  });

  it("rejects a symlinked plugin directory whose real location is outside the boundary", () => {
    // What `realpath` returns when `${BOUNDARY}/aidd-context` is itself a symlink to
    // somewhere else on disk - no `..` anywhere in the manifest's own path this time.
    const escapedViaSymlink = "/tmp/evil/payload";
    expect(isStrictlyWithin(escapedViaSymlink, BOUNDARY)).toBe(false);
  });

  it("rejects the boundary directory itself, never treating it as its own plugin", () => {
    expect(isStrictlyWithin(BOUNDARY, BOUNDARY)).toBe(false);
  });

  it("rejects the boundary directory spelled with a trailing separator", () => {
    expect(isStrictlyWithin(`${BOUNDARY}/`, BOUNDARY)).toBe(false);
  });

  it("rejects a path that merely starts with the boundary's characters without a separator", () => {
    // Textually starts with BOUNDARY but is a sibling directory, not something inside it -
    // a naive `startsWith` would wrongly accept this.
    expect(isStrictlyWithin(`${BOUNDARY}-evil/payload`, BOUNDARY)).toBe(false);
  });
});

describe("checking a path stays inside a boundary", () => {
  it("accepts the boundary itself", () => {
    expect(isWithin(BOUNDARY, BOUNDARY)).toBe(true);
  });

  it("accepts an entry whose name merely starts with two dots", () => {
    expect(isWithin(`${BOUNDARY}/..hidden/payload`, BOUNDARY)).toBe(true);
    expect(isStrictlyWithin(`${BOUNDARY}/..hidden`, BOUNDARY)).toBe(true);
  });

  it("rejects the parent directory and a sibling", () => {
    expect(isWithin("/home/dev/.cursor/plugins", BOUNDARY)).toBe(false);
    expect(isWithin(`${BOUNDARY}-evil`, BOUNDARY)).toBe(false);
  });
});

describe("the file name of a path", () => {
  it.each([
    ["a/b/c.md", "c.md"],
    ["plain.md", "plain.md"],
  ])("takes the last segment of %s", (path, expected) => {
    expect(basename(path)).toBe(expected);
  });
});

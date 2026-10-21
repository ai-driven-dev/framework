import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { legacyRepositoryIdOf } from "../../../../../src/contexts/telemetry/domain/legacy/legacy-repository-identity.js";

const sha = (text: string): string => createHash("sha256").update(text).digest("hex");

/** What cli-v5.5.0 stored: the migration finds a stored id by computing it again. */
describe("the repository id an earlier version stored", () => {
  it.each([
    ["git@github.com:Acme/Widgets.git", "github.com/Acme/Widgets"],
    ["git@GITHUB.com:acme/widgets", "github.com/acme/widgets"],
    ["https://GitHub.COM:443/Acme/widgets.git/", "github.com/Acme/widgets"],
    ["ssh://git@GitHub.COM:22/acme/widgets.git", "GitHub.COM/acme/widgets"],
    ["git://GitHub.com/acme/widgets", "GitHub.com/acme/widgets"],
    ["ssh://git@ssh.github.com:443/acme/widgets.git", "ssh.github.com/acme/widgets"],
    ["https://u:p@git.example.org/Team/Repo.git", "git.example.org/Team/Repo"],
  ])("of %s hashes %s", (remote, address) => {
    expect(legacyRepositoryIdOf({ remote, rootCommit: "c0ffee" })).toBe(sha(address));
  });

  it("is the root commit with no hosted origin, or none with neither", () => {
    expect(legacyRepositoryIdOf({ remote: "/srv/x.git", rootCommit: "c0ffee" })).toBe("c0ffee");
    expect(legacyRepositoryIdOf({ remote: "https://github.com/x", rootCommit: "c0ffee" })).toBe(
      "c0ffee"
    );
    expect(legacyRepositoryIdOf({ remote: null, rootCommit: null })).toBeNull();
  });
});

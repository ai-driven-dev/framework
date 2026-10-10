import { describe, expect, it } from "vitest";
import { withConsentGranted } from "../../../../../src/contexts/telemetry/domain/switch/resolution-consent.js";

const entry = (root: string, consented: boolean, repository_id = "r") => ({
  repository_id,
  root,
  consented,
});

describe("granting consent to remembered directories", () => {
  it("flips the refusals remembered for a repository's roots and keeps the entries", () => {
    const held = new Map([
      ["/gone/a", entry("/repo", false)],
      ["/gone/b", entry("/other", false, "x")],
      ["/gone/c", entry("/repo", true)],
    ]);
    const { resolutions, changed } = withConsentGranted(held, ["/repo"], "r", false);
    expect(changed).toBe(true);
    expect(resolutions.get("/gone/a")?.consented).toBe(true);
    expect(resolutions.get("/gone/b")?.consented).toBe(false);
    expect(resolutions.size).toBe(3);
    expect(held.get("/gone/a")?.consented).toBe(false);
  });

  it("grants a linked worktree deleted before the opt-in, by the repository it belonged to", () => {
    // `on` ran in the main tree; the worktree is neither the root it ran in nor its main root.
    const held = new Map([
      ["/gone/worktree", entry("/work/wt-beta", false)],
      ["/gone/other-repository", entry("/work/wt-other", false, "someone-else")],
    ]);
    const { resolutions, changed } = withConsentGranted(held, ["/work/main"], "r", false);
    expect(changed).toBe(true);
    expect(resolutions.get("/gone/worktree")?.consented).toBe(true);
    expect(resolutions.get("/gone/other-repository")?.consented).toBe(false);
  });

  it("grants by root alone when the repository has no identity", () => {
    const held = new Map([
      ["/gone/a", entry("/repo", false)],
      ["/gone/b", entry("/wt", false)],
    ]);
    const { resolutions } = withConsentGranted(held, ["/repo"], null, false);
    expect(resolutions.get("/gone/a")?.consented).toBe(true);
    expect(resolutions.get("/gone/b")?.consented).toBe(false);
  });

  it("is unchanged when nothing needed granting", () => {
    expect(
      withConsentGranted(new Map([["/g", entry("/repo", true)]]), ["/repo"], "r", false).changed
    ).toBe(false);
    expect(withConsentGranted(new Map(), ["/repo"], "r", false).changed).toBe(false);
  });

  it("folds case where the file system does", () => {
    const held = new Map([["/g", entry("/Repo", false)]]);
    expect(withConsentGranted(held, ["/repo"], null, true).changed).toBe(true);
    expect(withConsentGranted(held, ["/repo"], null, false).changed).toBe(false);
  });
});

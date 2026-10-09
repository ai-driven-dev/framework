import { describe, expect, it } from "vitest";
import { withConsentGranted } from "../../../../../src/contexts/telemetry/domain/switch/resolution-consent.js";

const entry = (root: string, consented: boolean) => ({ repository_id: "r", root, consented });

describe("granting consent to remembered directories", () => {
  it("flips the refusals remembered for a repository's roots and keeps the entries", () => {
    const held = new Map([
      ["/gone/a", entry("/repo", false)],
      ["/gone/b", entry("/other", false)],
      ["/gone/c", entry("/repo", true)],
    ]);
    const { resolutions, changed } = withConsentGranted(held, ["/repo"], false);
    expect(changed).toBe(true);
    expect(resolutions.get("/gone/a")?.consented).toBe(true);
    expect(resolutions.get("/gone/b")?.consented).toBe(false);
    expect(resolutions.size).toBe(3);
    expect(held.get("/gone/a")?.consented).toBe(false);
  });

  it("is unchanged when nothing needed granting", () => {
    expect(
      withConsentGranted(new Map([["/g", entry("/repo", true)]]), ["/repo"], false).changed
    ).toBe(false);
    expect(withConsentGranted(new Map(), ["/repo"], false).changed).toBe(false);
  });

  it("folds case where the file system does", () => {
    const held = new Map([["/g", entry("/Repo", false)]]);
    expect(withConsentGranted(held, ["/repo"], true).changed).toBe(true);
    expect(withConsentGranted(held, ["/repo"], false).changed).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { noticeFor } from "../../../../src/contexts/update/domain/update-notice.js";

const entry = (latest: string) => ({ checkedAt: 0, latest });

describe("noticeFor", () => {
  it("names both versions without their v, and the command to run", () => {
    expect(noticeFor(entry("v2.0.0"), "v1.0.0")).toStrictEqual([
      "CLI update available: v1.0.0 → v2.0.0",
      "Run `aidd update`.",
    ]);
  });

  it("strips only a leading v, never one inside a pre-release tag", () => {
    expect(noticeFor(entry("2.0.0-preview"), "1.0.0-dev")[0]).toBe(
      "CLI update available: v1.0.0-dev → v2.0.0-preview"
    );
  });

  it.each([
    ["the same version", "1.0.0", "1.0.0"],
    ["an older release", "0.9.0", "1.0.0"],
    ["a build that is no release", "1.0.0", "dev"],
  ])("says nothing for %s", (_label, latest, current) => {
    expect(noticeFor(entry(latest), current)).toStrictEqual([]);
  });
});

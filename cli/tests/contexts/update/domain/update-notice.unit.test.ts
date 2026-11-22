import { describe, expect, it } from "vitest";
import { noticeFor } from "../../../../src/contexts/update/domain/update-notice.js";

const entry = (latest: string) => ({ checkedAt: 0, latest });

describe("writing the update notice", () => {
  it("names both versions without their v", () => {
    expect(noticeFor(entry("v2.0.0"), "v1.0.0")).toStrictEqual({
      current: "1.0.0",
      latest: "2.0.0",
    });
  });

  it("strips only a leading v, never one inside a pre-release tag", () => {
    expect(noticeFor(entry("2.0.0-preview"), "1.0.0-dev")).toStrictEqual({
      current: "1.0.0-dev",
      latest: "2.0.0-preview",
    });
  });

  it.each([
    ["the same version", "1.0.0", "1.0.0"],
    ["an older release", "0.9.0", "1.0.0"],
    ["a build that is no release", "1.0.0", "dev"],
  ])("says nothing for %s", (_label, latest, current) => {
    expect(noticeFor(entry(latest), current)).toBeNull();
  });
});

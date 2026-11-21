import { describe, expect, it } from "vitest";
import { readCloneConsent } from "../../../../../src/contexts/telemetry/application/switch/clone-consent.js";
import { FakeConsents } from "../../testing/fake-consents.fake.js";
import { FakeLocator } from "../../testing/fake-locator.fake.js";
import { repository } from "../../testing/telemetry-switch.builder.js";

function setup() {
  const locator = new FakeLocator();
  const consents = new FakeConsents();
  locator.directories.set("/w/repo", repository("/w/repo"));
  return { locator, consents, read: (cwd: string) => readCloneConsent(locator, consents, cwd) };
}

describe("reading a clone's consent", () => {
  it("names the clone and the value its git config holds, or none", async () => {
    const s = setup();
    expect(await s.read("/w/repo")).toEqual({
      status: "read",
      located: repository("/w/repo"),
      value: null,
    });
    s.consents.values.set("/w/repo", "2:t");
    expect(await s.read("/w/repo")).toMatchObject({ status: "read", value: "2:t" });
  });

  it("refuses a directory outside a repository, and one git cannot read", async () => {
    const s = setup();
    s.locator.directories.set("/w/bad", { status: "unreadable" });
    expect(await s.read("/elsewhere")).toEqual({ status: "refused", reason: "outside-repository" });
    expect(await s.read("/w/bad")).toEqual({ status: "refused", reason: "unreadable-git-config" });
  });

  it("refuses a repository whose consent key it cannot read", async () => {
    const s = setup();
    s.consents.unreadable.add("/w/repo");
    expect(await s.read("/w/repo")).toEqual({ status: "refused", reason: "unreadable-git-config" });
  });
});

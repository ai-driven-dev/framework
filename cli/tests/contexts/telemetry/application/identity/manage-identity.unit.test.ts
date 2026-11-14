import { describe, expect, it } from "vitest";
import { ManageIdentity } from "../../../../../src/contexts/telemetry/application/identity/manage-identity.js";
import { InMemoryIdentity } from "../../testing/in-memory-identity.js";

function setup() {
  const identity = new InMemoryIdentity();
  return { identity, use: new ManageIdentity(identity) };
}

describe("choosing who the measurement names", () => {
  it("shows that nobody is named when nothing was chosen", async () => {
    expect(await setup().use.execute({ action: "show" })).toEqual({ status: "unset" });
  });

  it("names the person typed, trimmed, and shows it afterwards", async () => {
    const s = setup();
    const named = { status: "set", personId: "person-a" };
    expect(await s.use.execute({ action: "set", typed: "  person-a " })).toEqual(named);
    expect(await s.use.execute({ action: "show" })).toEqual(named);
  });

  it("refuses an identifier that is empty or spans lines, and writes nothing", async () => {
    const s = setup();
    expect(await s.use.execute({ action: "set", typed: "  " })).toEqual({ status: "refused" });
    expect(await s.use.execute({ action: "set", typed: "a\nb" })).toEqual({ status: "refused" });
    expect(s.identity.writes).toBe(0);
  });

  it("stops naming anyone, and says whether anyone was named", async () => {
    const s = setup();
    await s.use.execute({ action: "set", typed: "person-a" });
    expect(await s.use.execute({ action: "off" })).toEqual({ status: "removed" });
    expect(s.identity.personId).toBeNull();
    expect(await s.use.execute({ action: "off" })).toEqual({ status: "unset" });
  });
});

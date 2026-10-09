import { describe, expect, it } from "vitest";
import { ManageIdentityUseCase } from "../../../../../src/contexts/telemetry/application/identity/manage-identity-use-case.js";
import { InMemoryIdentity } from "../../../../helpers/ports/in-memory-telemetry.js";

function setup() {
  const identity = new InMemoryIdentity();
  return { identity, use: new ManageIdentityUseCase(identity) };
}

describe("choosing who the measurement names", () => {
  it("shows that nobody is named when nothing was chosen", async () => {
    expect(await setup().use.show()).toEqual({ status: "unset" });
  });

  it("names the person typed, trimmed, and shows it afterwards", async () => {
    const s = setup();
    expect(await s.use.set("  person-a ")).toEqual({ status: "set", personId: "person-a" });
    expect(s.identity.personId).toBe("person-a");
    expect(await s.use.show()).toEqual({ status: "set", personId: "person-a" });
  });

  it("refuses an identifier that is empty or spans lines, and writes nothing", async () => {
    const s = setup();
    expect(await s.use.set("  ")).toEqual({ status: "refused" });
    expect(await s.use.set("a\nb")).toEqual({ status: "refused" });
    expect(s.identity.writes).toBe(0);
  });

  it("stops naming anyone, and says whether anyone was named", async () => {
    const s = setup();
    await s.use.set("person-a");
    expect(await s.use.off()).toEqual({ status: "removed" });
    expect(s.identity.personId).toBeNull();
    expect(await s.use.off()).toEqual({ status: "unset" });
  });
});

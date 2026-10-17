import { describe, expect, it } from "vitest";
import { ProposeIdentityUseCase } from "../../../../../src/contexts/telemetry/application/identity/propose-identity-use-case.js";

function setup(user: string | null, refusedByEnvironment = false) {
  const asked: string[] = [];
  const use = new ProposeIdentityUseCase(
    {
      async userIn(cwd) {
        asked.push(cwd);
        return user;
      },
    },
    refusedByEnvironment
  );
  return { asked, use };
}

describe("the identifier offered to a person who has none", () => {
  it("is what git says in the directory, trimmed", async () => {
    const s = setup("  Ada Example ");
    expect(await s.use.execute("/w/repo")).toBe("Ada Example");
    expect(s.asked).toEqual(["/w/repo"]);
  });

  it("is nothing when git knows nobody", async () => {
    expect(await setup(null).use.execute("/w/repo")).toBeNull();
  });

  it("is nothing when the identity would be refused", async () => {
    expect(await setup("a".repeat(129)).use.execute("/w/repo")).toBeNull();
    expect(await setup("Ada\nExample").use.execute("/w/repo")).toBeNull();
  });

  it("is nothing under AIDD_TELEMETRY=0, and git is not asked", async () => {
    const s = setup("Ada Example", true);
    expect(await s.use.execute("/w/repo")).toBeNull();
    expect(s.asked).toEqual([]);
  });
});

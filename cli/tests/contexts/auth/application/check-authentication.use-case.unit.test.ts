import { describe, expect, it } from "vitest";
import { CheckAuthentication } from "../../../../src/contexts/auth/application/check-authentication.use-case.js";

describe("checking authentication", () => {
  it("reports an info line when no token resolves", async () => {
    const issues = await new CheckAuthentication({ resolve: async () => null }).execute();

    expect(issues).toStrictEqual([
      { severity: "info", message: "Not authenticated", fix: { code: "authenticate" } },
    ]);
  });

  it("says nothing when a token resolves", async () => {
    expect(await new CheckAuthentication({ resolve: async () => "token" }).execute()).toStrictEqual(
      []
    );
  });
});

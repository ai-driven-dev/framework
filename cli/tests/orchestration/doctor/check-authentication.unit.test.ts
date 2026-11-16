import { describe, expect, it } from "vitest";
import { CheckAuthentication } from "../../../src/orchestration/doctor/check-authentication.js";

describe("CheckAuthentication", () => {
  it("reports an info line when no token resolves", async () => {
    const issues = await new CheckAuthentication({ resolve: async () => null }).execute();

    expect(issues).toStrictEqual([
      { severity: "info", message: "Not authenticated", fix: "Run aidd auth login" },
    ]);
  });

  it("says nothing when a token resolves", async () => {
    expect(await new CheckAuthentication({ resolve: async () => "token" }).execute()).toStrictEqual(
      []
    );
  });
});

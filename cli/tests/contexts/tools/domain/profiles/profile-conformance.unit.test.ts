import { describe, expect, it } from "vitest";
import { REGISTERED_PROFILES } from "../../../../../src/contexts/tools/domain/profiles/registered-profiles.js";
import {
  describeProfileConformance,
  registeredIdsMatchToolVocabulary,
} from "../../testing/profile-conformance.js";

describe("the registered profiles", () => {
  it("register exactly the shared tool ids, once each", () => {
    registeredIdsMatchToolVocabulary(REGISTERED_PROFILES.map((profile) => profile.toolId));
  });

  it("include at least one AI tool and one IDE tool", () => {
    const kinds = REGISTERED_PROFILES.map((profile) => profile.kind === "ai");
    expect(kinds).toContain(true);
    expect(kinds).toContain(false);
  });

  for (const profile of REGISTERED_PROFILES) {
    describeProfileConformance(profile, REGISTERED_PROFILES);
  }
});

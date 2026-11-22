import { describe, expect, it } from "vitest";
import { REGISTERED_PROFILES } from "../../../../../src/composition/tool-profiles.composition.js";
import { describeProfileConformance } from "../../testing/profile-conformance.contract.js";
import { describeProfileTranslationConformance } from "../../testing/profile-translation-conformance.contract.js";

describe("the registered profiles", () => {
  it("include at least one AI tool and one IDE tool", () => {
    const kinds = REGISTERED_PROFILES.map((profile) => profile.kind === "ai");
    expect(kinds).toContain(true);
    expect(kinds).toContain(false);
  });

  for (const profile of REGISTERED_PROFILES) {
    describeProfileConformance(profile, REGISTERED_PROFILES);
    describeProfileTranslationConformance(profile, REGISTERED_PROFILES);
  }
});

import { describe, expect, it } from "vitest";
import { REGISTERED_PROFILES } from "../../../../../src/composition/tool-profiles/index.js";
import { profileData } from "../../testing/profile-data.builder.js";

describe("the data each registered profile declares", () => {
  for (const profile of REGISTERED_PROFILES) {
    it(profile.toolId, () => {
      expect(profileData(profile)).toMatchSnapshot();
    });
  }
});

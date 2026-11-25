import { describe, expect, it } from "vitest";
import {
  describeGuardedPluginRefMessage,
  frameworkSourceIsShared,
  refAnotherProjectStillNeeds,
} from "../../../../src/contexts/machine-claims/domain/shared-source-reference.model.js";

const BASE = {
  enablementIsMachineGlobal: true,
  otherProjects: ["/other-project"],
} as const;

describe("when a ref may be needed by another project", () => {
  it("is true when the ref came from the shared source, enablement is machine-global, and another project still references it", () => {
    expect(refAnotherProjectStillNeeds(BASE)).toBe(true);
  });

  it("is false when no other project references the shared source", () => {
    expect(refAnotherProjectStillNeeds({ ...BASE, otherProjects: [] })).toBe(false);
  });

  it("is false when this host's own enablement is not machine-global (claude)", () => {
    expect(refAnotherProjectStillNeeds({ ...BASE, enablementIsMachineGlobal: false })).toBe(false);
  });
});

describe("when the framework source is shared", () => {
  it("is false for the framework marketplace at project scope", () => {
    expect(frameworkSourceIsShared("aidd-framework", "project", "aidd-framework")).toBe(false);
  });

  it("is false for another marketplace at user scope", () => {
    expect(frameworkSourceIsShared("other-marketplace", "user", "aidd-framework")).toBe(false);
  });
});

// Nothing else in the suite pins this sentence's grammar, so a swapped singular/plural branch
// ("references"/"reference", "project"/"projects") would pass every other test.
describe("wording the guarded plugin ref message", () => {
  it("uses singular wording for exactly one other project", () => {
    const message = describeGuardedPluginRefMessage({
      binary: "codex",
      ref: "aidd-vcs@aidd-framework",
      otherProjects: ["/other-project"],
    });
    expect(message.text).toContain("1 other project still references");
  });

  it("uses plural wording and lists every project for more than one other project", () => {
    const message = describeGuardedPluginRefMessage({
      binary: "codex",
      ref: "aidd-vcs@aidd-framework",
      otherProjects: ["/other-project", "/third-project"],
    });
    expect(message).toEqual({
      text:
        "codex: 'aidd-vcs@aidd-framework' left enabled — codex enables a plugin machine-wide, and " +
        "2 other projects still reference the shared source: /other-project, /third-project — " +
        "which is why it stays",
      hint: "full-removal",
    });
  });

  it("names the projects and asks for the full-removal hint", () => {
    const message = describeGuardedPluginRefMessage({
      binary: "codex",
      ref: "aidd-vcs@aidd-framework",
      otherProjects: ["/other-project"],
    });
    expect(message.text).toContain("/other-project");
    expect(message.hint).toBe("full-removal");
  });

  it("states the fact once, not twice ('still reference' the source, not also 'still need it')", () => {
    const message = describeGuardedPluginRefMessage({
      binary: "codex",
      ref: "aidd-vcs@aidd-framework",
      otherProjects: ["/other-project"],
    });
    expect(message.text).toContain("still references the shared source");
    expect(message.text).not.toContain("need it");
  });
});

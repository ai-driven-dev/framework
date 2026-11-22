import { describe, expect, it } from "vitest";
import { assertNothingDepends } from "../../../../../src/contexts/installation/application/clean/assert-nothing-depends.js";
import { ActiveMachineDependentsError } from "../../../../../src/contexts/installation/domain/installation.error.js";
import type { UserScopeInspection } from "../../../../../src/contexts/installation/ports/user-scope/user-scope-purge.js";

describe("before a purge removes what others may depend on", () => {
  const inspection: UserScopeInspection = {
    manifestFound: true,
    toolIds: [],
    activePluginDependents: [],
    builtVersions: [],
    referencingProjects: [],
  };

  it("passes when nothing depends on what a purge removes", () => {
    expect(() => assertNothingDepends(inspection)).not.toThrow();
  });

  it("refuses an active plugin dependent", () => {
    expect(() => assertNothingDepends({ ...inspection, activePluginDependents: ["/a"] })).toThrow(
      ActiveMachineDependentsError
    );
  });

  it("refuses a project still referencing the shared framework source", () => {
    expect(() => assertNothingDepends({ ...inspection, referencingProjects: ["/p"] })).toThrow(
      ActiveMachineDependentsError
    );
  });
});

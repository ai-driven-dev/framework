import { describe, expect, it } from "vitest";
import { LenientUserSourceReferences } from "../../../../src/contexts/machine-claims/infrastructure/lenient-user-source-references.js";
import type { UserSourceReferences } from "../../../../src/contexts/machine-claims/ports/user-source-references.js";
import { UnreadableUserSourceReferencesError } from "../../../../src/shared/domain/shared.error.js";
import { CapturingLogger } from "../../../shared/testing/capturing-logger.fake.js";

function failingWith(error: Error): UserSourceReferences {
  const fail = async (): Promise<never> => {
    throw error;
  };
  return { addReference: fail, removeReference: fail, listAllReferencingProjects: fail };
}

describe("references that must not block the command", () => {
  const unreadable = new UnreadableUserSourceReferencesError("/refs.json", "corrupt");

  it("warns and carries on when the file cannot be read on a write", async () => {
    const logger = new CapturingLogger();
    const references = new LenientUserSourceReferences(failingWith(unreadable), logger);

    await references.addReference("1.0.0", "/p");
    await references.removeReference("/p");

    expect(logger.warnMessages).toHaveLength(2);
    expect(logger.warnMessages[0]).toContain("/refs.json");
  });

  it("reads an unreadable file as listing no project", async () => {
    const logger = new CapturingLogger();
    const references = new LenientUserSourceReferences(failingWith(unreadable), logger);

    expect(await references.listAllReferencingProjects()).toEqual([]);
    expect(logger.warnMessages).toHaveLength(1);
  });

  it("surfaces any other failure", async () => {
    const references = new LenientUserSourceReferences(
      failingWith(new Error("disk on fire")),
      new CapturingLogger()
    );

    await expect(references.addReference("1.0.0", "/p")).rejects.toThrow("disk on fire");
    await expect(references.listAllReferencingProjects()).rejects.toThrow("disk on fire");
  });
});

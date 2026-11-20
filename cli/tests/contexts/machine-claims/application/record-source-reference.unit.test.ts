import { describe, expect, it } from "vitest";
import { RecordSourceReference } from "../../../../src/contexts/machine-claims/application/record-source-reference.js";
import type { UserSourceReferences } from "../../../../src/contexts/machine-claims/ports/user-source-references.js";
import { UnreadableUserSourceReferencesError } from "../../../../src/shared/domain/errors.js";
import type { Scope } from "../../../../src/shared/domain/scope.js";
import { CapturingLogger } from "../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { RecordingSourceReferences } from "../testing/recording-source-references.fake.js";

const NAME = "aidd-framework";

function recorder(
  fs: InMemoryFileAdapter,
  references: UserSourceReferences | undefined,
  logger = new CapturingLogger()
) {
  return new RecordSourceReference(fs, { get: () => "1.2.3" }, logger, NAME, references);
}

function register(subject: RecordSourceReference, scope: Scope = "user", name = NAME) {
  return subject.execute({ projectRoot: "/link", marketplace: { name, scope } });
}

describe("recording that a project references the shared source", () => {
  it("records the running version against the project's real location", async () => {
    const fs = new InMemoryFileAdapter({}, ["/project"]);
    fs.setSymlink("/link", "/project");
    const references = new RecordingSourceReferences();

    await register(recorder(fs, references));

    expect(references.added).toEqual([{ version: "1.2.3", projectRoot: "/project" }]);
  });

  it("records it again on every run, not only the first", async () => {
    const references = new RecordingSourceReferences();
    const subject = recorder(new InMemoryFileAdapter({}, ["/link"]), references);

    await register(subject);
    await register(subject);

    expect(references.added).toHaveLength(2);
  });

  it("records nothing for a registration that is not the shared one", async () => {
    const references = new RecordingSourceReferences();
    const subject = recorder(new InMemoryFileAdapter({}, ["/link"]), references);

    await register(subject, "project");
    await register(subject, "user", "another");

    expect(references.added).toEqual([]);
  });

  it("records nothing when no references file is wired", async () => {
    await register(recorder(new InMemoryFileAdapter({}, ["/link"]), undefined));
  });

  it("warns and carries on when the references file cannot be read", async () => {
    const logger = new CapturingLogger();
    const unreadable: UserSourceReferences = {
      addReference: async () => {
        throw new UnreadableUserSourceReferencesError("/refs.json", "corrupt");
      },
      removeReference: async () => undefined,
      listAllReferencingProjects: async () => [],
    };

    await register(recorder(new InMemoryFileAdapter({}, ["/link"]), unreadable, logger));

    expect(logger.warnMessages).toHaveLength(1);
    expect(logger.warnMessages[0]).toContain("/refs.json");
  });

  it("surfaces any other failure", async () => {
    const broken: UserSourceReferences = {
      addReference: async () => {
        throw new Error("disk on fire");
      },
      removeReference: async () => undefined,
      listAllReferencingProjects: async () => [],
    };

    await expect(
      register(recorder(new InMemoryFileAdapter({}, ["/link"]), broken))
    ).rejects.toThrow("disk on fire");
  });
});

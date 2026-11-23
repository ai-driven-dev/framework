import { describe, expect, it } from "vitest";
import { RecordSourceReference } from "../../../../../src/contexts/machine-claims/application/shared-source/record-source-reference.use-case.js";
import { ResolveReferenceRoot } from "../../../../../src/contexts/machine-claims/application/shared-source/resolve-reference-root.use-case.js";
import type { UserSourceReferences } from "../../../../../src/contexts/machine-claims/ports/user-source-references.js";
import type { Scope } from "../../../../../src/shared/domain/scope.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { RecordingSourceReferences } from "../../testing/recording-source-references.fake.js";

const NAME = "aidd-framework";

function recorder(fs: InMemoryFileAdapter, references: UserSourceReferences | undefined) {
  return new RecordSourceReference({
    resolveReferenceRoot: new ResolveReferenceRoot(fs),
    currentVersion: "1.2.3",
    frameworkMarketplaceName: NAME,
    userSourceReferences: references,
  });
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
});

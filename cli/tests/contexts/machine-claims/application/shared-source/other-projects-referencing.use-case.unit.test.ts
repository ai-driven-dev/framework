import { describe, expect, it } from "vitest";
import { OtherProjectsReferencing } from "../../../../../src/contexts/machine-claims/application/shared-source/other-projects-referencing.use-case.js";
import { RecordingSourceReferences } from "../../testing/recording-source-references.fake.js";

describe("the other projects that still reference the shared source", () => {
  it("lists every referencing project but the project's own root", async () => {
    const references = new RecordingSourceReferences(["/project", "/other", "/third"]);

    expect(await new OtherProjectsReferencing(references, "linux").execute("/project")).toEqual([
      "/other",
      "/third",
    ]);
  });

  it("tells two spellings of one root apart only where the platform compares case", async () => {
    const references = new RecordingSourceReferences(["C:\\Work\\App"]);

    expect(
      await new OtherProjectsReferencing(references, "win32").execute("c:\\work\\app")
    ).toEqual([]);
    expect(
      await new OtherProjectsReferencing(references, "linux").execute("c:\\work\\app")
    ).toEqual(["C:\\Work\\App"]);
  });
});

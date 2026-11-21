import { describe, expect, it } from "vitest";
import { isPluginFileAtDesiredState } from "../../../../../src/contexts/installation/application/plugin/check-plugin-file-state.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";

describe("isPluginFileAtDesiredState()", () => {
  const path = "/p/a.md";
  const expected = FileHash.of("wanted").value;

  it("is false when the file is absent", async () => {
    expect(await isPluginFileAtDesiredState(new InMemoryFileAdapter(), path, expected)).toBe(false);
  });

  it("is false when the content differs from the expected hash", async () => {
    const fs = new InMemoryFileAdapter({ [path]: "edited" });

    expect(await isPluginFileAtDesiredState(fs, path, expected)).toBe(false);
  });

  it("is true when the content hashes to the expected value", async () => {
    const fs = new InMemoryFileAdapter({ [path]: "wanted" });

    expect(await isPluginFileAtDesiredState(fs, path, expected)).toBe(true);
  });
});

import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TrackedSettingsFile } from "../../../../../src/contexts/installation/application/sync/tracked-settings-file.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.js";

const ROOT = "/project";
const SETTINGS = ".claude/settings.json";
const ABSOLUTE = resolve(ROOT, SETTINGS);

function setup(files: Record<string, string> = {}) {
  const fs = new InMemoryFileAdapter(files);
  const logger = new CapturingLogger();
  return { fs, logger, file: new TrackedSettingsFile(fs, logger) };
}

describe("TrackedSettingsFile.load", () => {
  it("warns and starts from nothing when the file holds malformed JSON", async () => {
    const { file, logger } = setup({ [ABSOLUTE]: '{"enabledPlugins": {},}' });

    await expect(file.load(ROOT, SETTINGS)).resolves.toEqual({});
    expect(logger.warnMessages).toEqual([
      `Ignoring malformed JSON in ${ABSOLUTE}; rewriting the keys this CLI owns.`,
    ]);
  });
});

import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonFileMergerAdapter } from "../../../../src/contexts/installation/infrastructure/json-file-merger-adapter.js";
import { FileAdapter } from "../../../../src/shared/infrastructure/file-adapter.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import { describeFileMergerContract } from "../testing/file-merger.contract.js";

describeFileMergerContract("in memory", async () => ({
  merger: new InMemoryFileAdapter(),
  settingsPath: "/project/settings.json",
  dispose: async () => undefined,
}));

describeFileMergerContract("by JsonFileMergerAdapter on disk", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "aidd-file-merger-")));
  return {
    merger: new JsonFileMergerAdapter(new FileAdapter()),
    settingsPath: join(root, "settings.json"),
    dispose: () => rm(root, { recursive: true, force: true }),
  };
});

import { mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { FileAdapter } from "../../../src/shared/infrastructure/file-adapter.js";
import { InMemoryFileAdapter } from "../testing/in-memory-file-adapter.js";
import { describeFileContract, type FileSubject } from "../testing/run-file-contract.js";

describeFileContract("the in-memory double", async (): Promise<FileSubject> => {
  const files = new InMemoryFileAdapter({});
  return {
    files,
    root: join(sep, "contract-root"),
    link: async (target, path) => files.setSymlink(path, target),
    dispose: async () => undefined,
  };
});

describeFileContract("the real adapter on a temp dir", async (): Promise<FileSubject> => {
  // Resolved: macOS serves /var as /private/var, and Windows runners hand out 8.3 names.
  const root = await realpath(await mkdtemp(join(tmpdir(), "aidd-file-contract-")));
  return {
    files: new FileAdapter(),
    root,
    link: (target, path) => symlink(target, path, "dir"),
    dispose: () => rm(root, { recursive: true, force: true }),
  };
});

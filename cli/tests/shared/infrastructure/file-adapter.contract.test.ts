import { mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { HasherAdapter } from "../../../src/contexts/framework/infrastructure/hasher-adapter.js";
import { FileAdapter } from "../../../src/shared/infrastructure/file-adapter.js";
import { describeFileContract, type FileSubject } from "../../helpers/ports/file-port-contract.js";
import { InMemoryFileAdapter } from "../../helpers/ports/in-memory-file-adapter.js";

const hasher = new HasherAdapter();

const inMemorySubject = (rejectMissingRealpath: boolean) => async (): Promise<FileSubject> => {
  const files = new InMemoryFileAdapter({}, hasher);
  if (rejectMissingRealpath) files.rejectMissingRealpath();
  return {
    files,
    root: join(sep, "contract-root"),
    hasher,
    link: async (target, path) => files.setSymlink(path, target),
    dispose: async () => undefined,
  };
};

describeFileContract(
  "the in-memory double, realpath rejecting a missing path",
  inMemorySubject(true)
);

describeFileContract("the in-memory double", inMemorySubject(false), {
  C19: "realpath of a missing path answers the path instead of rejecting with ENOENT",
});

describeFileContract("the real adapter on a temp dir", async (): Promise<FileSubject> => {
  // Resolved: macOS serves /var as /private/var, and Windows runners hand out 8.3 names.
  const root = await realpath(await mkdtemp(join(tmpdir(), "aidd-file-contract-")));
  return {
    files: new FileAdapter(hasher),
    root,
    hasher,
    link: (target, path) => symlink(target, path, "dir"),
    dispose: () => rm(root, { recursive: true, force: true }),
  };
});

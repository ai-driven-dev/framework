import { mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { FileAdapter } from "../../../src/runtime/filesystem/file-adapter.js";
import { HasherAdapter } from "../../../src/runtime/filesystem/hasher-adapter.js";
import { describeFileContract, type FileSubject } from "../../helpers/ports/file-port-contract.js";
import { InMemoryFileAdapter } from "../../helpers/ports/in-memory-file-adapter.js";

const hasher = new HasherAdapter();

describeFileContract(
  "the in-memory double",
  async (): Promise<FileSubject> => {
    const files = new InMemoryFileAdapter({}, hasher);
    return {
      files,
      root: join(sep, "contract-root"),
      hasher,
      link: async (target, path) => files.setSymlink(path, target),
      dispose: async () => undefined,
    };
  },
  {
    C19: "V7: realpath of a missing path answers the path",
  }
);

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

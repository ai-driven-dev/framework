import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UserSourceReferencesAdapter } from "../../../../src/contexts/machine-claims/infrastructure/user-source-references-adapter.js";
import { FileAdapter } from "../../../../src/shared/infrastructure/file-adapter.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";
import {
  describeUserSourceReferencesContract,
  type UserSourceReferencesSubject,
} from "../testing/user-source-references.contract.js";

const CONFIG_DIR = "/fake-home/.config/aidd";

describeUserSourceReferencesContract(
  "in a fake file system",
  async (): Promise<UserSourceReferencesSubject> => {
    const fs = new InMemoryFileAdapter();
    return {
      references: new UserSourceReferencesAdapter(fs, () => CONFIG_DIR, "linux"),
      project: async (name) => {
        const root = `/projects/${name}`;
        fs.setFile(`${root}/marker`, "");
        return root;
      },
      vanish: async (root) => {
        await fs.deleteDirectory(root);
      },
      dispose: async () => undefined,
    };
  }
);

describeUserSourceReferencesContract(
  "on a temp dir",
  async (): Promise<UserSourceReferencesSubject> => {
    const base = await realpath(await mkdtemp(join(tmpdir(), "aidd-references-contract-")));
    return {
      references: new UserSourceReferencesAdapter(new FileAdapter(), () => join(base, "config")),
      project: async (name) => {
        const root = join(base, "projects", name);
        await mkdir(root, { recursive: true });
        return root;
      },
      vanish: (root) => rm(root, { recursive: true, force: true }),
      dispose: () => rm(base, { recursive: true, force: true }),
    };
  }
);

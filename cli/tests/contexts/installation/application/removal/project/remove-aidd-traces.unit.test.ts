import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RemoveAiddTraces } from "../../../../../../src/contexts/installation/application/removal/project/remove-aidd-traces.js";
import { UpdateGitignore } from "../../../../../../src/contexts/installation/application/update-gitignore.use-case.js";
import { Manifest } from "../../../../../../src/contexts/installation/domain/manifest.js";
import { CapturingLogger } from "../../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";

const ROOT = "/test-project";

function tracesOver(
  fs: InMemoryFileAdapter,
  repo = new InMemoryManifestRepository(null, ROOT),
  gitignore = new UpdateGitignore(fs)
): RemoveAiddTraces {
  return new RemoveAiddTraces(
    { fs, manifestRepo: repo, logger: new CapturingLogger(), updateGitignore: gitignore },
    registeredTools()
  );
}

describe("removing AIDD's traces from a project", () => {
  it("takes back every machine-local gitignore line the install added", async () => {
    const [machineLocal] = registeredTools().profile(TOOL.claude).machineLocalFiles();
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "1.0.0", []);
    const fs = new InMemoryFileAdapter();
    fs.setFile(join(ROOT, ".gitignore"), `node_modules\n.aidd/cache/\n${machineLocal}\n`);

    await tracesOver(fs).remove(manifest, ROOT);

    expect(await fs.readFile(join(ROOT, ".gitignore"))).toBe("node_modules\n");
  });

  it("has removed AIDD's own state by the time it takes the gitignore lines back", async () => {
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "1.0.0", []);
    const fs = new InMemoryFileAdapter();
    const repo = new InMemoryManifestRepository(manifest, ROOT);
    const gitignore = new UpdateGitignore(fs);
    const manifestWhenGitignoreIsTouched: Array<Manifest | null> = [];
    gitignore.remove = async () => {
      manifestWhenGitignoreIsTouched.push(await repo.load());
    };

    await tracesOver(fs, repo, gitignore).remove(manifest, ROOT);

    expect(manifestWhenGitignoreIsTouched).toEqual([null]);
  });
});

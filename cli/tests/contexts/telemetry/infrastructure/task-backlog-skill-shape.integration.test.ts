import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { TaskBacklogAdapter } from "../../../../src/contexts/telemetry/infrastructure/task-backlog-adapter.js";
import { REPOSITORY_ROOT } from "../../../helpers/repository-root.js";

/** Each skill's own example is fed through the real adapter over a real temp folder, never a
 * stand-in parser, so a field renamed on either side fails here. One skill ships the example
 * as an asset and the other fences it inline, so the loader below accepts both. */
const REPO_ROOT = REPOSITORY_ROOT;
const SPEC_EXAMPLE_JSON = join(
  REPO_ROOT,
  "plugins",
  "aidd-pm",
  "skills",
  "04-spec",
  "assets",
  "backlog-link-template.json"
);
const PLAN_SKILL_MD = join(
  REPO_ROOT,
  "plugins",
  "aidd-dev",
  "skills",
  "01-plan",
  "actions",
  "04-plan.md"
);

/** The literal example a skill tells an agent to write: the asset's own bytes, or the first
 * fenced json block, tolerant of a numbered-list item's indentation. `null` when none. */
function taughtExample(path: string): string | null {
  const text = readFileSync(path, "utf8");
  if (path.endsWith(".json")) return text.trim();
  const match = /^[ \t]*```json\r?\n([\s\S]*?)\r?\n[ \t]*```/mu.exec(text);
  return match?.[1] ?? null;
}

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

async function projectWithLink(json: string): Promise<{ root: string; taskFolder: string }> {
  const root = await mkdtemp(join(tmpdir(), "aidd-backlog-skill-shape-"));
  tempDirs.push(root);
  const taskFolder = "aidd_docs/tasks/2026_08/2026_08_21_example/";
  await mkdir(join(root, taskFolder), { recursive: true });
  await writeFile(join(root, taskFolder, "backlog-link.json"), json, "utf8");
  return { root, taskFolder };
}

describe.each([
  ["aidd-pm:04-spec", SPEC_EXAMPLE_JSON],
  ["aidd-dev:01-plan", PLAN_SKILL_MD],
])("%s's own backlog-link.json example matches what the reader accepts", (_skill, path) => {
  it("names a JSON example at all (guards against a no-op extraction)", () => {
    expect(taughtExample(path)).not.toBeNull();
  });

  it("parses through the real TaskBacklogAdapter as a declared item", async () => {
    const example = taughtExample(path);
    if (example === null) throw new Error("no json example to test");

    const { root, taskFolder } = await projectWithLink(`${example}\n`);
    const adapter = new TaskBacklogAdapter(root);

    const declaration = await adapter.read(taskFolder);

    expect(declaration.kind).toBe("declared");
    if (declaration.kind === "declared") {
      expect(declaration.link.backlog).toBe("owner/repo#123");
      expect(declaration.link.writtenAt.length).toBeGreaterThan(0);
      expect(declaration.link.writtenBy.length).toBeGreaterThan(0);
    }
  });
});

describe("both skills agree with each other, not only with the reader", () => {
  it("write the identical field names, so neither can drift from the other unnoticed", () => {
    const specExample = taughtExample(SPEC_EXAMPLE_JSON);
    const planExample = taughtExample(PLAN_SKILL_MD);
    expect(specExample).not.toBeNull();
    expect(planExample).not.toBeNull();

    const fieldNames = (json: string): readonly string[] =>
      Object.keys(JSON.parse(json) as Record<string, unknown>).sort();

    expect(fieldNames(specExample as string)).toEqual(fieldNames(planExample as string));
  });
});

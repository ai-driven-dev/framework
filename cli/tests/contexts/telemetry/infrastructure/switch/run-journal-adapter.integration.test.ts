import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RunJournalAdapter } from "../../../../../src/contexts/telemetry/infrastructure/switch/run-journal-adapter.js";
import { initRepository, sandboxGitEnv } from "../../../../helpers/git-sandbox.js";

let root: string;
let repo: string;
let adapter: RunJournalAdapter;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "aidd-journal-")));
  const env = sandboxGitEnv(root);
  repo = join(root, "repo");
  initRepository(repo, env);
  adapter = new RunJournalAdapter(env);
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const ignore = () => join(repo, ".gitignore");

describe("the run journal of the previous version", () => {
  it("finds nothing where there is nothing", async () => {
    expect(await adapter.clean(repo)).toEqual({
      journalRemoved: false,
      trackedKept: false,
      ignoreEntryRemoved: false,
    });
    expect(existsSync(ignore())).toBe(false);
  });

  it("leaves an ignore file without the entry as it was", async () => {
    writeFileSync(ignore(), "dist/\n");
    expect(await adapter.clean(repo)).toMatchObject({ ignoreEntryRemoved: false });
    expect(readFileSync(ignore(), "utf8")).toBe("dist/\n");
  });

  it("deletes an ignore file that held only the entry, and rewrites one that held more", async () => {
    writeFileSync(ignore(), "aidd_docs/runs/\n");
    expect(await adapter.clean(repo)).toMatchObject({ ignoreEntryRemoved: true });
    expect(existsSync(ignore())).toBe(false);
    writeFileSync(ignore(), "a\naidd_docs/runs/\nb");
    await adapter.clean(repo);
    expect(readFileSync(ignore(), "utf8")).toBe("a\nb");
  });

  it("removes the journal directory with what is in it", async () => {
    mkdirSync(join(repo, "aidd_docs", "runs", "nested"), { recursive: true });
    writeFileSync(join(repo, "aidd_docs", "runs", "nested", "a.jsonl"), "{}\n");
    expect(await adapter.clean(repo)).toMatchObject({ journalRemoved: true, trackedKept: false });
    expect(existsSync(join(repo, "aidd_docs", "runs"))).toBe(false);
  });
});

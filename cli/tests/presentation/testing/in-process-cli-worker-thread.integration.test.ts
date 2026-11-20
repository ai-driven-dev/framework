import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { runInProcess } from "./in-process-cli.js";

// A worker thread is what Stryker runs tests on; the substituted home does not hold there.
vi.mock("node:worker_threads", () => ({ isMainThread: false }));

it("refuses to run on a worker thread, where the substituted home would not hold", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "aidd-in-process-worker-")));
  try {
    await expect(runInProcess(["--help"], { cwd: root, home: root })).rejects.toThrow(
      "needs the main thread"
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

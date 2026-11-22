import { describe, expect, it } from "vitest";
import { ReadRememberedClones } from "../../../../../src/contexts/telemetry/application/forget/read-remembered-clones.use-case.js";
import type { BranchSnapshot } from "../../../../../src/contexts/telemetry/domain/branch-binding.js";
import { cloneOf } from "../../testing/clone.builder.js";
import { InMemoryConsentHistory } from "../../testing/in-memory-consent-history.fake.js";
import { InMemoryResolutions } from "../../testing/in-memory-resolutions.fake.js";
import { InMemorySnapshots } from "../../testing/in-memory-snapshots.fake.js";
import { deleted } from "../../testing/telemetry-switch.builder.js";

const snapshotOf = (repository_id: string, branch: string): BranchSnapshot => ({
  repository_id,
  branch,
  task: null,
  ticket: null,
  declared_at: null,
  none: false,
  branch_created_at: null,
  snapshot_at: "2026-10-01T00:00:00.000Z",
});

function setup() {
  const resolutions = new InMemoryResolutions();
  const history = new InMemoryConsentHistory();
  const snapshots = new InMemorySnapshots();
  return {
    resolutions,
    history,
    snapshots,
    read: () => new ReadRememberedClones(resolutions, history, snapshots).execute(),
  };
}

describe("listing the clones remembered", () => {
  it("holds nothing when nothing was kept", async () => {
    expect(await setup().read()).toEqual({ clones: [], consenting: new Set(), unlocated: 0 });
  });

  it("lists every clone a directory was seen alive in, sorted, whatever consent it found", async () => {
    const { resolutions, read } = setup();
    const b = deleted(cloneOf("/w/b/.git"), "/w/b");
    const a = deleted(cloneOf("/w/a/.git"), "/w/a");
    resolutions.resolutions.set("/w/b", b);
    resolutions.resolutions.set("/w/a", a);
    expect((await read()).clones).toEqual(["/w/a/.git", "/w/b/.git"]);
  });

  it("lists a clone that consented even when no session ever ran there", async () => {
    const { history, read } = setup();
    history.consented(cloneOf("/w/c/.git"));
    expect(await read()).toMatchObject({
      clones: ["/w/c/.git"],
      consenting: new Set(["/w/c/.git"]),
    });
  });

  it("counts the repositories that declared a task and whose location was never recorded", async () => {
    const { resolutions, snapshots, read } = setup();
    resolutions.resolutions.set("/gone/x", deleted());
    snapshots.appended.push(
      snapshotOf("c", "a"),
      snapshotOf("other", "a"),
      snapshotOf("other", "b"),
      snapshotOf("third", "a")
    );
    expect((await read()).unlocated).toBe(2);
  });
});

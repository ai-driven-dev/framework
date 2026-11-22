import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { AssertProjectPathWithinRoot } from "../../../../../src/contexts/installation/application/ownership/assert-project-path-within-root.use-case.js";
import {
  errnoError,
  FaultingFileAdapter,
} from "../../../../shared/testing/faulting-file-adapter.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";

const ROOT = resolve("/project");

describe("project-local mutation boundary", () => {
  it.each([ROOT, "/project/../foreign/file", "/project-sibling/file", "/foreign/file"])(
    "refuses a path outside the strict project subtree: %s",
    async (path) => {
      await expect(
        new AssertProjectPathWithinRoot(new FaultingFileAdapter({}, [ROOT])).execute(ROOT, path)
      ).rejects.toThrow(/escapes project root/);
    }
  );

  it("allows a new nested file only after resolving its nearest existing project parent", async () => {
    const fs = new FaultingFileAdapter({}, [ROOT]);
    for (const path of ["/project/new/deep/file", "/project/new/deep", "/project/new"])
      fs.failOn("realpath", path, errnoError("ENOENT"));
    fs.setFile("/project/marker", "project bytes");

    await expect(
      new AssertProjectPathWithinRoot(fs).execute(ROOT, "/project/new/deep/file")
    ).resolves.toBeUndefined();
    expect(fs.getFile("/project/marker")).toBe("project bytes");
  });

  it("refuses a missing file below a parent resolving outside the project", async () => {
    const fs = new FaultingFileAdapter({}, [ROOT]);
    fs.setSymlink("/project/link", "/foreign");
    fs.setFile("/foreign/new/marker", "foreign bytes");
    fs.failOn("realpath", "/project/link/new/file", errnoError("ENOENT"));

    await expect(
      new AssertProjectPathWithinRoot(fs).execute(ROOT, "/project/link/new/file")
    ).rejects.toThrow(/resolves outside project root/);
    expect(fs.getFile("/foreign/new/marker")).toBe("foreign bytes");
  });

  it("propagates an unreadable path instead of treating it as a missing child", async () => {
    const fs = new FaultingFileAdapter({}, [ROOT]);
    const error = errnoError("EACCES");
    fs.failOn("realpath", "/project/private/file", error);

    await expect(
      new AssertProjectPathWithinRoot(fs).execute(ROOT, "/project/private/file")
    ).rejects.toBe(error);
  });

  it("refuses a project root that disappears while a missing child is being resolved", async () => {
    const fs = new FaultingFileAdapter({}, [ROOT]);
    let rootRead = false;
    vi.spyOn(fs, "realpath").mockImplementation(async (path) => {
      if (path === ROOT && !rootRead) {
        rootRead = true;
        return ROOT;
      }
      throw errnoError("ENOENT");
    });

    await expect(
      new AssertProjectPathWithinRoot(fs).execute(ROOT, "/project/new/file")
    ).rejects.toThrow(/Project root.*disappeared/);
  });

  it("allows a child of a project whose own root is a symlink", async () => {
    const fs = new FaultingFileAdapter({}, [ROOT]);
    fs.setSymlink(ROOT, "/canonical-project");
    fs.setFile("/canonical-project/file", "project bytes");

    await expect(
      new AssertProjectPathWithinRoot(fs).execute(ROOT, "/project/file")
    ).resolves.toBeUndefined();
  });
});

describe("project-local mutation boundary on a filesystem that rejects a missing path", () => {
  it("allows a missing nested file once an existing project parent resolves inside the root", async () => {
    const fs = new InMemoryFileAdapter({
      "/project/marker": "project bytes",
    });

    await expect(
      new AssertProjectPathWithinRoot(fs).execute(ROOT, "/project/new/deep/file")
    ).resolves.toBeUndefined();
  });

  it("refuses a missing file below a link resolving outside the project", async () => {
    const fs = new InMemoryFileAdapter({
      "/project/marker": "project bytes",
      "/foreign/keep": "foreign bytes",
    });
    fs.setSymlink("/project/link", "/foreign");

    await expect(
      new AssertProjectPathWithinRoot(fs).execute(ROOT, "/project/link/new/file")
    ).rejects.toThrow(/resolves outside project root/);
  });

  it("propagates ENOENT of a project root that does not exist, refusing the mutation", async () => {
    const fs = new InMemoryFileAdapter();

    await expect(
      new AssertProjectPathWithinRoot(fs).execute(ROOT, "/project/new/file")
    ).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});

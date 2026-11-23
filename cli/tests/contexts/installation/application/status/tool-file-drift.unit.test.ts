import { describe, expect, it } from "vitest";
import {
  addedFileDrift,
  mergeFileDrift,
  restorableDrift,
  trackedFileDrift,
} from "../../../../../src/contexts/installation/application/status/tool-file-drift.js";
import { FileHash } from "../../../../../src/shared/domain/file-hash.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";

const ROOT = "/project";

describe("comparing a tracked file with the disk", () => {
  const files = [{ relativePath: ".tool/a.md", hash: FileHash.of("a") }];

  it("reports nothing for a file as installed", async () => {
    const fs = new InMemoryFileAdapter({ "/project/.tool/a.md": "a" }, [ROOT]);

    expect(await trackedFileDrift(fs, files, ROOT)).toEqual([]);
  });

  it("reports a missing file as deleted", async () => {
    const fs = new InMemoryFileAdapter({}, [ROOT]);

    expect(await trackedFileDrift(fs, files, ROOT)).toEqual([
      { relativePath: ".tool/a.md", status: "deleted" },
    ]);
  });

  it("reports an edited file as modified", async () => {
    const fs = new InMemoryFileAdapter({ "/project/.tool/a.md": "edited" }, [ROOT]);

    expect(await trackedFileDrift(fs, files, ROOT)).toEqual([
      { relativePath: ".tool/a.md", status: "modified" },
    ]);
  });
});

describe("comparing a merge file with the disk", () => {
  const mergeFile = {
    relativePath: ".tool/mcp.json",
    sectionKey: "servers",
    entries: { srv: FileHash.of(JSON.stringify({ command: "node" })) },
  };

  it("reports every key of an absent file as deleted", async () => {
    const fs = new InMemoryFileAdapter({}, [ROOT]);

    expect(await mergeFileDrift(fs, [mergeFile], ROOT)).toEqual([
      { relativePath: ".tool/mcp.json > srv", status: "deleted" },
    ]);
  });

  it("reports a key whose value changed as modified and one removed as deleted", async () => {
    const changed = JSON.stringify({ servers: { srv: { command: "bun" } } });
    const fs = new InMemoryFileAdapter({ "/project/.tool/mcp.json": changed }, [ROOT]);
    const two = { ...mergeFile, entries: { ...mergeFile.entries, gone: FileHash.of("x") } };

    expect(await mergeFileDrift(fs, [two], ROOT)).toEqual([
      { relativePath: ".tool/mcp.json > srv", status: "modified" },
      { relativePath: ".tool/mcp.json > gone", status: "deleted" },
    ]);
  });
});

describe("looking for files the install did not write", () => {
  const scan = {
    directory: ".tool/",
    isTracked: (path: string) => path === ".tool/kept.md",
    projectRoot: ROOT,
    machineLocal: [".tool/local.json"],
  };

  it("reports only the untracked files, not backups or machine-local ones", async () => {
    const fs = new InMemoryFileAdapter(
      {
        "/project/.tool/kept.md": "",
        "/project/.tool/new.md": "",
        "/project/.tool/old.md.backup": "",
        "/project/.tool/local.json": "",
      },
      [ROOT, "/project/.tool"]
    );

    expect(await addedFileDrift(fs, scan)).toEqual([
      { relativePath: ".tool/new.md", status: "added" },
    ]);
  });

  it("reports nothing when the tool directory is absent", async () => {
    const fs = new InMemoryFileAdapter({}, [ROOT]);

    expect(await addedFileDrift(fs, scan)).toEqual([]);
  });
});

describe("choosing which drifted files a restore can bring back", () => {
  it("keeps the files the install wrote and lost, never one the person added", () => {
    const drift = [
      { relativePath: "a", status: "modified" as const },
      { relativePath: "b", status: "deleted" as const },
      { relativePath: "c", status: "added" as const },
    ];
    expect(restorableDrift(drift)).toEqual(["a", "b"]);
  });
});

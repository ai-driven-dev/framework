import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ManifestRepositoryAdapter } from "../../../../src/contexts/installation/infrastructure/manifest-repository-adapter.js";
import { UserManifestRepositoryAdapter } from "../../../../src/contexts/installation/infrastructure/user-manifest-repository-adapter.js";
import { manifestFileDeps } from "../../../contexts/installation/testing/manifest-file-deps.builder.js";
import { createTestEnv } from "../../../shared/testing/cli-sandbox.builder.js";
import { runInProcess } from "../../../shared/testing/in-process-cli.builder.js";
import { FRAMEWORK_REAL, setupFromFixture } from "../../testing/fixture-setup.builder.js";
import { listFilesUnder, readJson } from "../../testing/project-state.builder.js";

/** The state the last published CLI writing v8 left, its sandbox paths replaced by placeholders. */
const RELEASED_V8 = join(import.meta.dirname, "../../../fixtures/manifests/released-v8");

let project: string;
let home: string;
let cleanup: () => Promise<void>;
const userConfigDir = () => join(home, ".config", "aidd");

beforeEach(async () => {
  ({ projectDir: project, fakeHome: home, cleanup } = await createTestEnv("released-v8"));
  for (const [root, dir] of [
    ["project", project],
    ["home", home],
  ] as const) {
    for (const path of await listFilesUnder(join(RELEASED_V8, root))) {
      const raw = await readFile(join(RELEASED_V8, root, path), "utf-8");
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await writeFile(
        join(dir, path),
        raw
          .replaceAll("<project>", JSON.stringify(project).slice(1, -1))
          .replaceAll("<framework>", JSON.stringify(FRAMEWORK_REAL).slice(1, -1))
      );
    }
  }
});

afterEach(async () => {
  await cleanup();
});

const aidd = (args: string[]) => runInProcess(args, { cwd: project, home });

/** Every file of the project and the home, by a digest of its bytes. */
async function everyFile(): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const root of [project, home]) {
    for (const path of await listFilesUnder(root)) {
      const bytes = await readFile(join(root, path));
      files[join(root, path)] = createHash("sha256").update(bytes).digest("hex");
    }
  }
  return files;
}

/** A cursor hook entry the install recorded, edited since, which a detach refuses to remove. */
async function editCursorHooks(): Promise<void> {
  await mkdir(join(project, ".cursor"), { recursive: true });
  await writeFile(
    join(project, ".cursor", "hooks.json"),
    JSON.stringify({
      version: 1,
      hooks: {
        sessionStart: [
          { command: "node ./.cursor/hooks/aidd-context/memory.cjs load", timeout: 9 },
        ],
      },
    })
  );
}

/** The same state as its first save writes it. */
async function writeAsV9(): Promise<void> {
  for (const repository of [
    new ManifestRepositoryAdapter(
      project,
      manifestFileDeps(() => join(project, ".aidd"))
    ),
    new UserManifestRepositoryAdapter(userConfigDir, manifestFileDeps(userConfigDir)),
  ]) {
    const manifest = await repository.load();
    if (manifest !== null) await repository.save(manifest);
  }
  expect((await readJson(join(userConfigDir(), "manifest.json"))).version).toBe(9);
}

describe("a state the last v8 CLI left", () => {
  it.each([[["doctor"]], [["clean"]], [["plugin", "list"]]])(
    "is read by %j as its v9 form is, and left byte-identical",
    async (args) => {
      const before = await everyFile();

      const onV8 = await aidd(args);

      expect(await everyFile()).toStrictEqual(before);
      await writeAsV9();
      expect(await aidd(args)).toStrictEqual(onV8);
    }
  );

  it("is left byte-identical by a setup refused before it writes, but for the fetch it made", async () => {
    await editCursorHooks();
    const before = await everyFile();

    const refused = await aidd(setupFromFixture("cursor", "aidd-context"));

    expect(refused.stderr).toContain("detach refused");
    const after = await everyFile();
    const fetched = join(userConfigDir(), "marketplaces.json");
    expect(after[fetched]).not.toBe(before[fetched]);
    expect({ ...after, [fetched]: "" }).toStrictEqual({ ...before, [fetched]: "" });
  });

  it("has its user manifest written as v9, its dependents as claims, by a user setup that succeeds", async () => {
    const setup = await aidd(setupFromFixture("opencode", "aidd-async-dev", ["--scope", "user"]));

    expect(setup.exitCode, setup.stderr).toBe(0);
    expect((await readJson(join(userConfigDir(), "manifest.json"))).version).toBe(9);
    const claims = await readJson(join(userConfigDir(), "plugin-claims.json"));
    expect(claims).toStrictEqual({
      cursor: [
        "aidd-context",
        "aidd-dev",
        "aidd-vcs",
        "aidd-pm",
        "aidd-orchestrator",
        "aidd-refine",
      ].map((plugin) => ({ plugin, dependents: [project] })),
    });
  });
});

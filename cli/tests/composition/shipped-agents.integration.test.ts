import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SmolTomlCodec } from "../../src/contexts/tools/infrastructure/smol-toml-codec.adapter.js";
import { parseFrontmatter } from "../../src/shared/domain/markdown.js";
import { createTestEnv } from "../shared/testing/cli-sandbox.builder.js";
import { runInProcess } from "../shared/testing/in-process-cli.builder.js";
import { REPOSITORY_ROOT } from "../shared/testing/repository-root.builder.js";
import { singlePluginSource } from "./testing/single-plugin-source.builder.js";

const TOML = new SmolTomlCodec();

const PLUGIN = "aidd-orchestrator";
const SOURCE_DIR = join(REPOSITORY_ROOT, "plugins", PLUGIN, "agents");

/** Where each host loads a project's agents, and the frontmatter it reads beyond the description. */
const HOSTS = [
  { host: "claude", dir: ".claude/agents", ext: ".md", extra: (id: string) => ({ name: id }) },
  { host: "codex", dir: ".codex/agents", ext: ".toml", extra: (id: string) => ({ name: id }) },
  {
    host: "copilot",
    dir: ".github/agents",
    ext: ".agent.md",
    extra: (id: string) => ({ name: id, "include-custom-instructions": true }),
  },
  { host: "cursor", dir: ".cursor/agents", ext: ".md", extra: (id: string) => ({ name: id }) },
  { host: "opencode", dir: ".opencode/agents", ext: ".md", extra: () => ({ mode: "subagent" }) },
  { host: "kilo", dir: ".kilo/agents", ext: ".md", extra: () => ({ mode: "subagent" }) },
] as const;

let source: string;
let removeSource: () => Promise<void>;

beforeAll(async () => {
  ({ source, remove: removeSource } = await singlePluginSource(PLUGIN));
});

afterAll(async () => {
  await removeSource();
});

let project: string;
let home: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ projectDir: project, fakeHome: home, cleanup } = await createTestEnv("shipped-agents"));
});

afterEach(async () => {
  await cleanup();
});

describe("the shipped agents, built flat for each host", () => {
  it.each(HOSTS)(
    "$host loads every agent at its path, with its own frontmatter",
    async ({ host, dir, ext, extra }) => {
      const build = await runInProcess(
        ["translate", source, "--to", host, "--as", "flat", "--out", project],
        { cwd: project, home }
      );
      expect(build.exitCode, build.stderr).toBe(0);

      const sources = (await readdir(SOURCE_DIR)).filter((file) => file.endsWith(".md")).sort();
      const installed = (await readdir(join(project, dir)))
        .filter((file) => file.startsWith(`${PLUGIN}-`))
        .sort();
      expect(installed).toEqual(sources.map((file) => `${PLUGIN}-${file.slice(0, -3)}${ext}`));

      for (const file of sources) {
        const source = parseFrontmatter(await readFile(join(SOURCE_DIR, file), "utf8"));
        const id = `${PLUGIN}-${file.slice(0, -3)}`;
        const content = await readFile(join(project, dir, `${id}${ext}`), "utf8");
        const { body, ...frontmatter } =
          host === "codex"
            ? (({ developer_instructions, ...rest }) => ({
                ...rest,
                body: developer_instructions,
              }))(TOML.parse(content))
            : { ...parseFrontmatter(content).frontmatter, body: parseFrontmatter(content).body };
        expect(frontmatter, `${host} ${file}`).toStrictEqual({
          description: source.frontmatter.description,
          ...extra(id),
        });
        expect(body, `${host} ${file}`).toBe(source.body);
      }
    }
  );
});

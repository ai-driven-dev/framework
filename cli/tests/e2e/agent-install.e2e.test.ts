import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseToml } from "../../src/contexts/tools/domain/profiles/codex/toml.js";
import { parseFrontmatter } from "../../src/kernel/markdown.js";
import { REPOSITORY_ROOT } from "../helpers/repository-root.js";
import { createTestEnv, runCli } from "./helpers.js";

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

describe.concurrent("E2E: the shipped agents, installed into each host", () => {
  it.each(HOSTS)(
    "$host loads every agent at its path, with its own frontmatter",
    async ({ host, dir, ext, extra }) => {
      const { projectDir, fakeHome, cleanup } = await createTestEnv(`agents-${host}`);
      try {
        const build = await runCli(
          ["translate", REPOSITORY_ROOT, "--to", host, "--as", "flat", "--out", projectDir],
          projectDir,
          fakeHome
        );
        expect(build.exitCode, build.stderr).toBe(0);

        const sources = (await readdir(SOURCE_DIR)).filter((file) => file.endsWith(".md")).sort();
        const installed = (await readdir(join(projectDir, dir)))
          .filter((file) => file.startsWith(`${PLUGIN}-`))
          .sort();
        expect(installed).toEqual(sources.map((file) => `${PLUGIN}-${file.slice(0, -3)}${ext}`));

        for (const file of sources) {
          const source = parseFrontmatter(await readFile(join(SOURCE_DIR, file), "utf8"));
          const id = `${PLUGIN}-${file.slice(0, -3)}`;
          const content = await readFile(join(projectDir, dir, `${id}${ext}`), "utf8");
          const { body, ...frontmatter } =
            host === "codex"
              ? (({ developer_instructions, ...rest }) => ({
                  ...rest,
                  body: developer_instructions,
                }))(parseToml(content) as Record<string, unknown>)
              : { ...parseFrontmatter(content).frontmatter, body: parseFrontmatter(content).body };
          expect(frontmatter, `${host} ${file}`).toStrictEqual({
            description: source.frontmatter.description,
            ...extra(id),
          });
          expect(body, `${host} ${file}`).toBe(source.body);
        }
      } finally {
        await cleanup();
      }
    }
  );
});

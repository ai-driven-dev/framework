import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { antigravityProjectHooksFormat as format } from "../../../../../../src/contexts/tools/domain/profiles/antigravity/antigravity-hooks.js";

describe("Antigravity hook response", () => {
  let root: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), "aidd-agy-response-")));
    mkdirSync(join(root, ".agents", "hooks", "fixture"), { recursive: true });
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  function run(script: string, args = "", input = "") {
    writeFileSync(join(root, ".agents", "hooks", "fixture", "hook.cjs"), script);
    const hooks = JSON.stringify({
      hooks: {
        SessionStart: [
          {
            hooks: [
              {
                type: "command",
                // biome-ignore lint/suspicious/noTemplateCurlyInString: authored plugin root is rewritten by the profile
                command: `node "${"${CLAUDE_PLUGIN_ROOT}"}/hooks/hook.cjs" ${args}`,
              },
            ],
          },
        ],
      },
    });
    const { content } = format.merge(null, hooks, "fixture");
    const [{ entry }] = format.contributedEntries(content, "fixture");
    return spawnSync(entry.command, {
      shell: true,
      cwd: join(root, ".agents"),
      input,
      encoding: "utf8",
      timeout: 10000,
    });
  }

  it("responds with an empty JSON object when the script succeeds silently", () => {
    const result = run("");

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("{}");
  });

  it("preserves existing JSON stdout byte for byte", () => {
    const response = ' { "additionalContext": "déjà reçu" }\n';
    const result = run(`process.stdout.write(${JSON.stringify(response)});`);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe(response);
  });

  it("preserves stdin, stderr and the repository working directory", () => {
    const input = '{"event":"SessionStart","value":"$ ` \\" é"}\n';
    const result = run(
      `process.stderr.write('diagnostic\\n');
process.stdout.write(JSON.stringify({cwd:process.cwd(),input:require('node:fs').readFileSync(0,'utf8')}));`,
      "",
      input
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("diagnostic\n");
    expect(JSON.parse(result.stdout)).toEqual({ cwd: root, input });
  });

  it("preserves a failing script's exit code and diagnostics", () => {
    const result = run("process.stderr.write('failed\\n');process.exitCode=23;");

    expect(result.status).toBe(23);
    expect(result.stderr).toBe("failed\n");
    expect(result.stdout).toBe("{}");
  });

  it("runs the original shell command without expanding its arguments twice", () => {
    const argument = "spaces 'quote' $dollar `backtick`";
    const quoted =
      process.platform === "win32" ? `"${argument}"` : `'${argument.replaceAll("'", `'"'"'`)}'`;
    const result = run("process.stdout.write(JSON.stringify(process.argv.slice(2)));", quoted);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual([argument]);
  });
});

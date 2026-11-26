import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { antigravity } from "../../../../../../src/composition/tool-profiles/antigravity.js";
import { present } from "../../../../../shared/testing/present.builder.js";
import { supported } from "../../../testing/build-artifacts.builder.js";

const PLUGIN_DIR = join(".agents", "plugins", "fixture");

type Handler = { command: string };
type Group = Handler | { hooks: Handler[] };

/** The first command a plugin's converted hooks.json holds for an event, grouped or not. */
function commandOf(hooksJson: string, event: string): string {
  const [first] = JSON.parse(hooksJson).fixture[event] as Group[];
  return "hooks" in first ? first.hooks[0].command : first.command;
}

describe("Antigravity hook response", () => {
  let root: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), "aidd-agy-response-")));
    mkdirSync(join(root, PLUGIN_DIR, "hooks"), { recursive: true });
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  function run(script: string, args = "", input = "", event = "SessionStart") {
    writeFileSync(join(root, PLUGIN_DIR, "hooks", "hook.cjs"), script);
    const hooks = JSON.stringify({
      hooks: {
        [event]: [
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
    const converted = supported(present(antigravity.buildContracts.marketplace)().artifacts.hooks);
    const command = commandOf(converted.transform?.(hooks, "fixture", "hooks.json") ?? "", event);
    return spawnSync(command, {
      shell: true,
      cwd: join(root, PLUGIN_DIR),
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

  it("lets the tool run when a script about to refuse a tool call succeeds silently", () => {
    const result = run("", "", "", "PreToolUse");

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('{"decision":"allow"}');
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

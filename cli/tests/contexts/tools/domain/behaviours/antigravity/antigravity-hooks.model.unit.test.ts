import { describe, expect, it } from "vitest";
import { antigravity } from "../../../../../../src/composition/tool-profiles/antigravity.js";
import { present } from "../../../../../shared/testing/present.builder.js";
import { supported } from "../../../testing/build-artifacts.builder.js";

// biome-ignore lint/suspicious/noTemplateCurlyInString: the Claude placeholder a plugin writes
const PLUGIN_ROOT_VAR = "${CLAUDE_PLUGIN_ROOT}";

const { transform } = supported(present(antigravity.buildContracts.marketplace)().artifacts.hooks);
const pluginHooks = (json: string, plugin: string): string =>
  transform?.(json, plugin, "hooks.json") ?? "";

const SHIPPED = JSON.stringify({
  hooks: {
    SessionStart: [
      { hooks: [{ type: "command", command: `node ${PLUGIN_ROOT_VAR}/hooks/update_memory.js` }] },
    ],
    PostToolUse: [
      {
        matcher: "Write|Edit|Bash",
        hooks: [{ type: "command", command: `node ${PLUGIN_ROOT_VAR}/hooks/mark.js`, timeout: 5 }],
      },
    ],
    SessionEnd: [{ hooks: [{ type: "command", command: `node ${PLUGIN_ROOT_VAR}/hooks/end.js` }] }],
  },
});

const decoded = (command: string): string =>
  Buffer.from(command.slice(command.lastIndexOf(" ") + 1), "base64").toString();

describe("a plugin's hooks as agy reads them from the plugin's own directory", () => {
  const file = JSON.parse(pluginHooks(SHIPPED, "aidd-context"));

  it("holds one named group, the plugin's, and only the events agy fires", () => {
    expect(Object.keys(file)).toEqual(["aidd-context"]);
    expect(Object.keys(file["aidd-context"])).toEqual(["SessionStart", "PostToolUse"]);
  });

  it("names each script from the project root its handler runs in", () => {
    const [start] = file["aidd-context"].SessionStart;

    expect(decoded(start.command)).toBe(
      "node ./.agents/plugins/aidd-context/hooks/update_memory.js"
    );
    expect(start.command).toContain("cwd:'../../..'");
  });

  it("keeps a tool event's timeout and renames its matcher's tools to agy's", () => {
    const [group] = file["aidd-context"].PostToolUse;

    expect([group.matcher, group.hooks[0].timeout]).toEqual([
      "write_file|edit_file|run_command",
      5,
    ]);
  });
});

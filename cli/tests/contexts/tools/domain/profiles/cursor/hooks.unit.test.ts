import { describe, expect, it } from "vitest";
import type { ArtifactContract } from "../../../../../../src/contexts/tools/domain/build-contract.js";
import { buildCursorFlatContract } from "../../../../../../src/contexts/tools/domain/profiles/cursor/build.js";
import { cursor } from "../../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";

// biome-ignore lint/suspicious/noTemplateCurlyInString: the placeholder a plugin's hooks name
const ROOT = "${CLAUDE_PLUGIN_ROOT}";
const asIs = (path: string) => path;

function flatFile() {
  const hooks: ArtifactContract = buildCursorFlatContract().artifacts.hooks;
  if (!hooks.supported || hooks.hooksFile === undefined) throw new Error("no hooks file");
  return hooks.hooksFile;
}

function projectFormat() {
  const format = cursor.capabilities.plugins.projectHooksFormat;
  if (format === null) throw new Error("no project hooks");
  return format;
}

describe("a matcher group that declares no hooks list", () => {
  const groupless = JSON.stringify({
    hooks: { Stop: [{ matcher: "x" }, { hooks: [{ command: "a" }] }] },
  });

  it("is skipped by the Cursor merge", () => {
    expect(JSON.parse(flatFile().merge(null, groupless, "p", asIs).content)).toStrictEqual({
      version: 1,
      hooks: { stop: [{ command: "a" }], sessionEnd: [{ command: "a" }] },
    });
  });
});

describe("an event Cursor does not fire", () => {
  const notify = JSON.stringify({ hooks: { Notification: [{ hooks: [{ command: "a" }] }] } });

  it("is skipped and reported under Cursor's name by a flat build", () => {
    expect(flatFile().merge(null, notify, "p", asIs).warnings).toStrictEqual([
      "cursor: unmapped event 'Notification' skipped",
    ]);
  });
});

describe("rewriting a plugin's root token for the project hooks file", () => {
  it("leaves a plugin-relative path outside hooks/ where it was", () => {
    const shipped = JSON.stringify({
      hooks: {
        PostToolUse: [{ hooks: [{ type: "command", command: `node ${ROOT}/scripts/run.cjs` }] }],
      },
    });

    expect(JSON.parse(projectFormat().merge(null, shipped, "plugin-a").content)).toStrictEqual({
      version: 1,
      hooks: { postToolUse: [{ command: "node scripts/run.cjs" }] },
    });
  });
});

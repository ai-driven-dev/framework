import { describe, expect, it } from "vitest";
import { parseDelegation } from "../../../../src/contexts/framework/domain/delegation.js";

describe("project delegation suggestions", () => {
  it("leaves absent tasks and settings unspecified", () => {
    expect(
      parseDelegation(null, "exploration", "codex", "/repo/.aidd/config.json")
    ).toBeUndefined();
    expect(
      parseDelegation('{"telemetry":{"enabled":true}}', "exploration", "codex", "/c")
    ).toBeUndefined();
    expect(
      parseDelegation('{"delegation":{"other":false}}', "exploration", "codex", "/c")
    ).toBeUndefined();
    expect(
      parseDelegation(
        '{"delegation":{"exploration":{"agent":"aidd-dev:explorer"}}}',
        "exploration",
        "codex",
        "/c"
      )
    ).toEqual({
      plugin: "aidd-dev",
      role: "explorer",
      canonical: "aidd-dev:explorer",
      requested: {},
    });
  });

  it("selects only the requested host without changing native model literals", () => {
    const raw = JSON.stringify({
      delegation: {
        exploration: {
          agent: "aidd-dev:explorer",
          tools: { codex: { model: "provider/model-v99", effort: "high" }, other: false },
        },
      },
    });
    expect(parseDelegation(raw, "exploration", "codex", "/c")?.requested).toEqual({
      model: "provider/model-v99",
      effort: "high",
    });
  });

  it.each([
    ["{", "valid JSON"],
    ["[]", "JSON object"],
    ['{"delegation":[]}', "delegation"],
    ['{"delegation":{"exploration":null}}', "delegation.exploration"],
    ['{"delegation":{"exploration":{"agent":"../bad:role"}}}', "plugin:role"],
    ['{"delegation":{"exploration":{"agent":"aidd-dev:explorer","models":{}}}}', "models"],
    ['{"delegation":{"exploration":{"agent":"aidd-dev:explorer","tools":[]}}}', "tools"],
    [
      '{"delegation":{"exploration":{"agent":"aidd-dev:explorer","tools":{"codex":null}}}}',
      "tools.codex",
    ],
    [
      '{"delegation":{"exploration":{"agent":"aidd-dev:explorer","tools":{"codex":{"model":""}}}}}',
      "model",
    ],
    [
      '{"delegation":{"exploration":{"agent":"aidd-dev:explorer","tools":{"codex":{"effort":7}}}}}',
      "effort",
    ],
    [
      '{"delegation":{"exploration":{"agent":"aidd-dev:explorer","tools":{"codex":{"reasoning":"high"}}}}}',
      "reasoning",
    ],
  ])("reports the requested malformed field with its file", (raw, field) => {
    expect(() => parseDelegation(raw, "exploration", "codex", "/repo/.aidd/config.json")).toThrow(
      field
    );
    expect(() => parseDelegation(raw, "exploration", "codex", "/repo/.aidd/config.json")).toThrow(
      "/repo/.aidd/config.json"
    );
  });
});

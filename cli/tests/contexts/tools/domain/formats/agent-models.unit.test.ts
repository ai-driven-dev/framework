import { describe, expect, it } from "vitest";
import {
  agentIdeNames,
  agentModelOptions,
  isAgentHost,
  isAgentProvider,
  resolveAgentHost,
} from "../../../../../src/contexts/tools/domain/formats/agent-models.js";
import { claude } from "../../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import { codex } from "../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import { parseToml } from "../../../../../src/contexts/tools/domain/profiles/codex/toml.js";
import { copilot } from "../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import { cursor } from "../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import { opencode } from "../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { parseFrontmatter, serializeFrontmatter } from "../../../../../src/kernel/markdown.js";

describe("explicit agent models", () => {
  it.each([
    ["claude-code", "claude"],
    ["claude", "claude"],
    ["codex", "codex"],
    ["copilot", "copilot"],
    ["opencode", "opencode"],
    ["cursor", "cursor"],
  ])("resolves IDE %s to host %s", (ide, expected) => {
    expect(resolveAgentHost(ide)).toBe(expected);
  });

  it.each(["kilo", "unknown", "constructor", ""])("rejects unsupported IDE %s", (ide) => {
    expect(() => resolveAgentHost(ide)).toThrow(/not supported/);
  });

  it("lists the configured public IDE names", () => {
    expect(agentIdeNames()).toStrictEqual([
      "claude-code",
      "codex",
      "copilot",
      "opencode",
      "cursor",
    ]);
  });

  it.each([
    ["claude", "anthropic", { model: "claude-haiku-5-5", effort: "medium" }],
    ["codex", "openai", { model: "gpt-6-luna", model_reasoning_effort: "medium" }],
    ["copilot", "openai", { model: "gpt-6-luna", reasoningEffort: "medium" }],
    ["copilot", "anthropic", { model: "claude-haiku-5.5", reasoningEffort: "medium" }],
    ["opencode", "openai", { model: "openai/gpt-6-luna#medium" }],
    ["opencode", "anthropic", { model: "anthropic/claude-haiku-5-5#medium" }],
    ["opencode", "mistral", { model: "mistral/mistral-small-latest#high" }],
    ["cursor", "anthropic", { model: "claude-haiku-5-5[effort=medium]" }],
  ] as const)("serializes %s with the selected %s provider", (host, provider, expected) => {
    for (const role of ["explorer", "executor", "validator"])
      expect(agentModelOptions(host, provider, role)).toStrictEqual(expected);
  });

  it.each([
    ["codex", "openai", { model: "gpt-6.1-sol", model_reasoning_effort: "medium" }],
    ["copilot", "openai", { model: "gpt-6.1-sol", reasoningEffort: "medium" }],
    ["opencode", "openai", { model: "openai/gpt-6.1-sol#medium" }],
  ] as const)(
    "shares model and effort between main and review on %s / %s",
    (host, provider, expected) => {
      for (const role of ["main", "reviewer"])
        expect(agentModelOptions(host, provider, role)).toStrictEqual(expected);
    }
  );

  it.each([
    [
      "claude",
      { model: "claude-opus-5-5", effort: "medium" },
      { model: "claude-sonnet-5-5", effort: "medium" },
    ],
    [
      "copilot",
      { model: "claude-opus-5.5", reasoningEffort: "medium" },
      { model: "claude-sonnet-5.5", reasoningEffort: "medium" },
    ],
    [
      "opencode",
      { model: "anthropic/claude-opus-5-5#medium" },
      { model: "anthropic/claude-sonnet-5-5#medium" },
    ],
    [
      "cursor",
      { model: "claude-opus-5-5[effort=medium]" },
      { model: "claude-sonnet-5-5[effort=medium]" },
    ],
  ] as const)("runs Anthropic's main on Opus and review on Sonnet on %s", (host, main, review) => {
    expect(agentModelOptions(host, "anthropic", "main")).toStrictEqual(main);
    expect(agentModelOptions(host, "anthropic", "reviewer")).toStrictEqual(review);
  });

  it("gives Mistral a larger main model than its reviewer on opencode", () => {
    expect(agentModelOptions("opencode", "mistral", "main")).toStrictEqual({
      model: "mistral/mistral-large-4#high",
    });
    expect(agentModelOptions("opencode", "mistral", "reviewer")).toStrictEqual({
      model: "mistral/mistral-medium-latest#high",
    });
  });

  it.each(["unknown", "constructor", "__proto__", ""])("rejects unconfigured role %s", (role) => {
    expect(() => agentModelOptions("codex", "openai", role)).toThrow(/role.*not configured/);
  });

  it.each([
    ["claude", "openai"],
    ["codex", "anthropic"],
    ["cursor", "openai"],
    ["claude", "mistral"],
    ["codex", "mistral"],
    ["copilot", "mistral"],
    ["cursor", "mistral"],
  ] as const)("rejects unsupported %s / %s selections", (host, provider) => {
    expect(() => agentModelOptions(host, provider, "reviewer")).toThrow(/not supported/);
  });

  it.each(["claude", "codex", "copilot", "opencode", "cursor"])(
    "recognizes the native %s host",
    (host) => expect(isAgentHost(host)).toBe(true)
  );
  it.each(["claude-code", "kilo", "", "toString", "constructor", "__proto__", null, undefined, 1])(
    "rejects unknown host %s",
    (host) => {
      expect(isAgentHost(host)).toBe(false);
    }
  );
  it.each(["openai", "anthropic", "mistral"])("recognizes provider %s", (provider) => {
    expect(isAgentProvider(provider)).toBe(true);
  });
  it.each(["unknown", "", "toString", "constructor", "__proto__", null, undefined, 1])(
    "rejects unknown provider %s",
    (provider) => {
      expect(isAgentProvider(provider)).toBe(false);
    }
  );
});

describe("generic agent conversion", () => {
  for (const host of [claude, codex, copilot, cursor, opencode]) {
    it(`${host.toolId} leaves unconfigured agents unpinned`, () => {
      const converted = host.capabilities.agents.convertFrontmatter(
        { name: "explorer", description: "Role" },
        "explorer.md"
      );
      for (const field of ["model", "effort", "model_reasoning_effort", "reasoningEffort"]) {
        expect(converted).not.toHaveProperty(field);
      }
      for (const build of Object.values(host.buildContracts ?? {})) {
        const artifact = build().artifacts.agents;
        if (!artifact.supported || artifact.transform === undefined)
          throw new Error("Missing agent transform");
        const content = artifact.transform(
          "---\nname: explorer\ndescription: Role\n---\nBody\n",
          "aidd-dev",
          "explorer.md"
        );
        const fields =
          host.toolId === "codex" ? parseToml(content) : parseFrontmatter(content).frontmatter;
        expect(fields).not.toHaveProperty("model");
      }
    });
  }

  it.each([
    [claude, { model: "custom-native", effort: "high" }],
    [codex, { model: "custom-native", model_reasoning_effort: "high" }],
    [copilot, { model: "custom-native", reasoningEffort: "high" }],
    [cursor, { model: "custom-native" }],
    [opencode, { model: "custom-native#high" }],
  ] as const)("preserves explicit settings for $toolId", (host, options) => {
    const capability = host.capabilities.agents;
    const frontmatter = { name: "explorer", description: "Role", ...options };
    const converted = capability.convertFrontmatter(frontmatter, "explorer.md");
    expect(converted).toMatchObject(options);
    const serialized = capability.serialize(converted, "Body");
    expect(
      host.toolId === "codex" ? parseToml(serialized) : parseFrontmatter(serialized).frontmatter
    ).toMatchObject(options);
    for (const build of Object.values(host.buildContracts ?? {})) {
      const artifact = build().artifacts.agents;
      if (!artifact.supported || artifact.transform === undefined)
        throw new Error("Missing agent transform");
      const content = artifact.transform(
        serializeFrontmatter(frontmatter, "Body"),
        "aidd-dev",
        "explorer.md"
      );
      expect(
        host.toolId === "codex" ? parseToml(content) : parseFrontmatter(content).frontmatter
      ).toMatchObject(options);
    }
  });
});

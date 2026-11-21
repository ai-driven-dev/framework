import { describe, expect, it } from "vitest";
import { resolveScopeBase } from "../../../../../src/contexts/installation/domain/manifest/scope-base.js";
import { UnresolvableUserScopeError } from "../../../../../src/shared/domain/errors/unresolvable-user-scope-error.js";
import type { AiToolId } from "../../../../../src/shared/domain/tool.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const PROJECT_ROOT = "/proj";
const USER_BASE = "/home/u/.tool/plugins";

const userScope = (userBaseDir: () => string | null | undefined, toolId: AiToolId): string =>
  resolveScopeBase({ scope: "user", projectRoot: PROJECT_ROOT, userBaseDir, toolId });

describe("base directory of a recorded scope", () => {
  it("is the project root for a project scope, without asking for the user directory", () => {
    const base = resolveScopeBase({
      scope: "project",
      projectRoot: PROJECT_ROOT,
      userBaseDir: () => {
        throw new Error("the user directory must not be read");
      },
      toolId: TOOL.cursor,
    });

    expect(base).toBe(PROJECT_ROOT);
  });

  it("is the tool's user plugins directory for a user scope", () => {
    expect(userScope(() => USER_BASE, TOOL.cursor)).toBe(USER_BASE);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
  ])(
    "refuses a user scope whose tool declares %s, rather than falling back to the project",
    (_label, declared) => {
      expect(() => userScope(() => declared, TOOL.claude)).toThrow(UnresolvableUserScopeError);
    }
  );

  it("names the tool in the refusal", () => {
    expect(() => userScope(() => null, TOOL.claude)).toThrow(`"${TOOL.claude}"`);
  });
});

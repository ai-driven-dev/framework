import { describe, expect, it } from "vitest";
import {
  IdentityOffWithIdentifierError,
  SyncFailedError,
  UnknownAiToolIdError,
  UserScopeFilterUnsupportedError,
} from "../../src/presentation/presentation.error.js";

describe("IdentityOffWithIdentifierError", () => {
  it("says exactly what went wrong", () => {
    const error = new IdentityOffWithIdentifierError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "IdentityOffWithIdentifierError",
      message: "--off removes the identity: give it no identifier.",
    });
  });

  it("carries its stable code", () => {
    expect(new IdentityOffWithIdentifierError().code).toBe("identity-off-with-identifier");
  });
});

describe("SyncFailedError", () => {
  it("says exactly what went wrong", () => {
    const error = new SyncFailedError([
      { scope: "claude", message: "x" },
      { scope: "codex", message: "y" },
    ]);
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "SyncFailedError",
      message: "Sync failed for: claude, codex. See the warnings above.",
    });
  });

  it("carries its stable code", () => {
    expect(
      new SyncFailedError([
        { scope: "claude", message: "x" },
        { scope: "codex", message: "y" },
      ]).code
    ).toBe("sync-failed");
  });
});

describe("UnknownAiToolIdError", () => {
  it("says exactly what went wrong", () => {
    const error = new UnknownAiToolIdError("zed", ["claude", "cursor"]);
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UnknownAiToolIdError",
      message: "Unknown AI tool: zed. Valid AI tools: claude, cursor",
    });
  });

  it("carries its stable code", () => {
    expect(new UnknownAiToolIdError("zed", ["claude", "cursor"]).code).toBe("unknown-ai-tool-id");
  });
});

describe("UserScopeFilterUnsupportedError", () => {
  it("says exactly what went wrong", () => {
    const error = new UserScopeFilterUnsupportedError("--plugin", "sync");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UserScopeFilterUnsupportedError",
      message:
        "--scope user tracks nothing --plugin can narrow — it names every requested tool, not one plugin or one file. Drop --plugin, or run `aidd sync` at project scope.",
    });
  });

  it("carries its stable code", () => {
    expect(new UserScopeFilterUnsupportedError("--plugin", "sync").code).toBe(
      "user-scope-filter-unsupported"
    );
  });
});

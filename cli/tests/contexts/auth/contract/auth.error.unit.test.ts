import { describe, expect, it } from "vitest";
import { AuthStorageError, GhCliError } from "../../../../src/contexts/auth/contract/auth.error.js";

describe("when AuthStorageError is raised", () => {
  it("carries its detail and says nothing itself", () => {
    const error = new AuthStorageError("no write");
    expect({ name: error.name, detail: error.detail, message: error.message }).toStrictEqual({
      name: "AuthStorageError",
      detail: "no write",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new AuthStorageError("no write").code).toBe("auth-storage");
  });
});

describe("when GhCliError is raised", () => {
  it("carries its detail and says nothing itself", () => {
    const error = new GhCliError("gh exited 1");
    expect({ name: error.name, detail: error.detail, message: error.message }).toStrictEqual({
      name: "GhCliError",
      detail: "gh exited 1",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new GhCliError("gh exited 1").code).toBe("gh-cli");
  });
});

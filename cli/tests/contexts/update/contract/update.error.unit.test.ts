import { describe, expect, it } from "vitest";
import {
  ElevatedPermissionUpdateError,
  FrameworkResolutionError,
  PackageManagerDetectionError,
  UpdateError,
} from "../../../../src/contexts/update/contract/update.error.js";

describe("when ElevatedPermissionUpdateError is raised", () => {
  it("carries the command that updates directly and says nothing itself", () => {
    const error = new ElevatedPermissionUpdateError("npm install -g x@latest");
    expect({
      name: error.name,
      command: error.installCommand,
      message: error.message,
    }).toStrictEqual({
      name: "ElevatedPermissionUpdateError",
      command: "npm install -g x@latest",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new ElevatedPermissionUpdateError("npm install -g x@latest").code).toBe(
      "elevated-permission-update"
    );
  });
});

describe("when FrameworkResolutionError is raised", () => {
  it("carries its detail and says nothing itself", () => {
    const error = new FrameworkResolutionError("no framework");
    expect({ name: error.name, detail: error.detail, message: error.message }).toStrictEqual({
      name: "FrameworkResolutionError",
      detail: "no framework",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new FrameworkResolutionError("no framework").code).toBe("framework-resolution");
  });
});

describe("when PackageManagerDetectionError is raised", () => {
  it("carries the commands to run by hand and says nothing itself", () => {
    const error = new PackageManagerDetectionError(["npm i -g x", "pnpm add -g x"]);
    expect({ name: error.name, commands: error.commands, message: error.message }).toStrictEqual({
      name: "PackageManagerDetectionError",
      commands: ["npm i -g x", "pnpm add -g x"],
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new PackageManagerDetectionError(["npm i -g x", "pnpm add -g x"]).code).toBe(
      "package-manager-detection"
    );
  });
});

describe("when UpdateError is raised", () => {
  it("says nothing itself", () => {
    const error = new UpdateError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UpdateError",
      message: "",
    });
  });

  it("carries its stable code", () => {
    expect(new UpdateError().code).toBe("update");
  });
});

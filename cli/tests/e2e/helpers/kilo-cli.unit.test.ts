import { describe, expect, it } from "vitest";
import { resolveKiloBin } from "./kilo-cli.js";

describe("Kilo CLI executable resolution", () => {
  const env = {
    APPDATA: "C:\\ci\\runner\\AppData\\Roaming",
    PATH: "C:\\Tools",
  };

  it.each(["cli-windows-x64", "cli-windows-x64-baseline", "cli-windows-arm64"])(
    "resolves the hoisted Windows %s package directly",
    (packageName) => {
      const expected = `C:\\ci\\runner\\AppData\\Roaming\\npm\\node_modules\\@kilocode\\${packageName}\\bin\\kilo.exe`;
      expect(resolveKiloBin("win32", env, (candidate) => candidate === expected)).toBe(expected);
    }
  );

  it("resolves an npm-nested Windows package when it is not hoisted", () => {
    const expected =
      "C:\\ci\\runner\\AppData\\Roaming\\npm\\node_modules\\@kilocode\\cli\\node_modules\\@kilocode\\cli-windows-x64-baseline\\bin\\kilo.exe";
    expect(resolveKiloBin("win32", env, (candidate) => candidate === expected)).toBe(expected);
  });

  it("derives APPDATA from USERPROFILE without assuming the runner profile", () => {
    const expected =
      "C:\\profiles\\custom-user\\AppData\\Roaming\\npm\\node_modules\\@kilocode\\cli-windows-arm64\\bin\\kilo.exe";
    expect(
      resolveKiloBin(
        "win32",
        { USERPROFILE: "C:\\profiles\\custom-user" },
        (candidate) => candidate === expected
      )
    ).toBe(expected);
  });

  it("keeps the command shim as a fallback when no Windows package is installed", () => {
    expect(resolveKiloBin("win32", env, () => false)).toBe(
      "C:\\ci\\runner\\AppData\\Roaming\\npm\\kilo.cmd"
    );
  });
});

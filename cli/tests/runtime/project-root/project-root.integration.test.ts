import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveProjectRoot } from "../../../src/runtime/project-root/project-root.js";

describe("resolveProjectRoot", () => {
  const savedPwd = process.env.PWD;
  let elsewhere: string;

  beforeEach(async () => {
    elsewhere = await mkdtemp(join(tmpdir(), "aidd-project-root-"));
  });

  afterEach(async () => {
    if (savedPwd === undefined) delete process.env.PWD;
    else process.env.PWD = savedPwd;
    await rm(elsewhere, { recursive: true, force: true });
  });

  it("prefers the shell's PWD when it names another existing directory", () => {
    process.env.PWD = elsewhere;
    expect(resolveProjectRoot()).toBe(elsewhere);
  });

  it("answers the working directory when PWD names a directory that is gone", () => {
    process.env.PWD = join(elsewhere, "gone");
    expect(resolveProjectRoot()).toBe(process.cwd());
  });

  it("answers the working directory when PWD is unset", () => {
    delete process.env.PWD;
    expect(resolveProjectRoot()).toBe(process.cwd());
  });

  it("answers the working directory when PWD already names it", () => {
    process.env.PWD = process.cwd();
    expect(resolveProjectRoot()).toBe(process.cwd());
  });
});

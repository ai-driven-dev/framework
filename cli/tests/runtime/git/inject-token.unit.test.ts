import { describe, expect, it } from "vitest";
import { gitHttpAuthentication } from "../../../src/runtime/git/inject-token.js";

describe("Git HTTP authentication", () => {
  it("passes a GitHub token separately from the clean URL", () => {
    expect(gitHttpAuthentication("https://github.com/owner/repo.git", "tk")).toEqual({
      url: "https://github.com/owner/repo.git",
      authorization: `Authorization: Basic ${Buffer.from("x-access-token:tk").toString("base64")}`,
    });
  });

  it.each([
    "https://gitlab.com/owner/repo.git",
    "https://bitbucket.org/owner/repo.git",
    "https://dev.azure.com/org/repo.git",
    "https://gist.github.com/owner/repo.git",
    "https://evil.example/github.com/owner/repo.git",
    "https://notgithub.com/owner/repo.git",
    "https://github.com.attacker.example/repo.git",
    "https://example.com/repo.git?from=github.com",
    "http://github.com/owner/repo.git",
    "git@github.com:owner/repo.git",
  ])("does not send a resolved token to %s", (url) => {
    expect(gitHttpAuthentication(url, "tk")).toEqual({ url });
  });

  it("removes and decodes explicit HTTP userinfo without storing it in the URL", () => {
    expect(
      gitHttpAuthentication("https://user:p%40ss@part@example.com/repo.git", undefined)
    ).toEqual({
      url: "https://example.com/repo.git",
      authorization: `Authorization: Basic ${Buffer.from("user:p@ss@part").toString("base64")}`,
    });
  });

  it("removes explicit credentials even when the HTTPS scheme is uppercase", () => {
    expect(gitHttpAuthentication("HTTPS://user:secret@example.com/repo.git", undefined)).toEqual({
      url: "https://example.com/repo.git",
      authorization: `Authorization: Basic ${Buffer.from("user:secret").toString("base64")}`,
    });
  });

  it("does not create authentication without a token or userinfo", () => {
    expect(gitHttpAuthentication("https://github.com/owner/repo.git", undefined)).toEqual({
      url: "https://github.com/owner/repo.git",
    });
  });

  it.each(["user", ":password"])("accepts partial explicit userinfo", (userinfo) => {
    const credentials = userinfo.includes(":") ? userinfo : `${userinfo}:`;
    expect(gitHttpAuthentication(`https://${userinfo}@example.com/repo.git`, undefined)).toEqual({
      url: "https://example.com/repo.git",
      authorization: `Authorization: Basic ${Buffer.from(credentials).toString("base64")}`,
    });
  });

  it("does not derive HTTP authentication from a non-HTTP URL containing an HTTP URL", () => {
    const url = "ssh://git@example.com/path/https://other.example/repo.git";
    expect(gitHttpAuthentication(url, "tk")).toEqual({ url });
  });
});

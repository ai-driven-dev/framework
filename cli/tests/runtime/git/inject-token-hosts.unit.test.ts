import { describe, expect, it } from "vitest";
import { withoutCredentials } from "../../../src/runtime/git/inject-token.js";

describe("withoutCredentials", () => {
  it("strips a credential from an http URL as well", () => {
    expect(withoutCredentials("http://user:pw@host/repo.git")).toBe("http://host/repo.git");
  });

  it("strips only a credential at the start of the URL", () => {
    expect(withoutCredentials("x https://user@host/repo")).toBe("x https://user@host/repo");
  });

  it("leaves a URL carrying no credential alone", () => {
    expect(withoutCredentials("https://host/repo.git")).toBe("https://host/repo.git");
  });

  it("does not alter non-HTTP URLs, even when their path contains an HTTP URL", () => {
    const url = "ssh://git@example.com/path/https://other.example/repo.git";
    expect(withoutCredentials(url)).toBe(url);
  });

  it.each(["u", "user:secret@part"])(
    "removes userinfo from malformed HTTP URLs even when URL parsing fails",
    (userinfo) => {
      expect(withoutCredentials(`https://${userinfo}@ bad-host/repo`)).toBe(
        "https:// bad-host/repo"
      );
    }
  );

  it("also removes credentials from malformed plain HTTP URLs", () => {
    expect(withoutCredentials("http://user:secret@ bad-host/repo")).toBe("http:// bad-host/repo");
  });
});

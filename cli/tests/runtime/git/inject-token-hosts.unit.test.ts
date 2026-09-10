import { describe, expect, it } from "vitest";
import { injectTokenIntoUrl, withoutCredentials } from "../../../src/runtime/git/inject-token.js";

describe("injectTokenIntoUrl, Azure DevOps", () => {
  it("uses an empty user with the token as password", () => {
    expect(injectTokenIntoUrl("https://dev.azure.com/org/repo", "tok")).toBe(
      "https://:tok@dev.azure.com/org/repo"
    );
  });
});

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
});

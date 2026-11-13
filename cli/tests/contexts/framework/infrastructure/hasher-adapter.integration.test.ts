import { describe, expect, it } from "vitest";
import { HasherAdapter } from "../../../../src/contexts/framework/infrastructure/hasher-adapter.js";

describe("HasherAdapter", () => {
  const hasher = new HasherAdapter();

  it("hashes the UTF-8 bytes of the content with MD5", () => {
    expect(hasher.hash("héllo").value).toBe("be50e8478cf24ff3595bc7307fb91b50");
  });
});

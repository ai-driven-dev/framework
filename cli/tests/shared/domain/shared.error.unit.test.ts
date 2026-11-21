import { describe, expect, it } from "vitest";
import {
  AiddError,
  AssetNotFoundError,
  AuthenticationError,
  CatalogFetchAuthError,
  CatalogFetchError,
  CatalogFetchNotFoundError,
  HttpError,
  HttpNotFoundError,
  HttpRedirectError,
  InputRequiredError,
  InvalidInstallScopeError,
  InvalidMarketplaceNameError,
  InvalidPluginManifestError,
  InvalidPluginSourceError,
  InvalidSourceMarketplaceError,
  JsonParseError,
  ManifestValidationError,
  McpConfigError,
  ToolNotInManifestError,
  UnreadableUserSourceReferencesError,
  UnregisteredToolError,
  VersionMismatchError,
} from "../../../src/shared/domain/shared.error.js";

describe("AiddError", () => {
  class ProbeError extends AiddError {
    readonly code = "probe";
  }

  it("is an Error that carries the stable code its subclass names", () => {
    const error = new ProbeError("words");
    expect(error).toBeInstanceOf(Error);
    expect({ code: error.code, message: error.message }).toStrictEqual({
      code: "probe",
      message: "words",
    });
  });
});

describe("AssetNotFoundError", () => {
  it("says exactly what went wrong", () => {
    const error = new AssetNotFoundError("schema.json");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "AssetNotFoundError",
      message: "Bundled asset not found: 'schema.json'",
    });
  });

  it("carries its stable code", () => {
    expect(new AssetNotFoundError("schema.json").code).toBe("asset-not-found");
  });
});

describe("AuthenticationError", () => {
  it("says exactly what went wrong", () => {
    const error = new AuthenticationError("gh");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "AuthenticationError",
      message: "Authentication failed (gh). Run `aidd auth login` to authenticate.",
    });
  });

  it("carries its stable code", () => {
    expect(new AuthenticationError("gh").code).toBe("authentication");
  });
});

describe("CatalogFetchAuthError", () => {
  it("says exactly what went wrong", () => {
    const error = new CatalogFetchAuthError("https://x/c.json");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "CatalogFetchAuthError",
      message:
        'Authentication required to fetch catalog from "https://x/c.json". Run `aidd auth login` first or use `--source local --path <dir>`.',
    });
  });

  it("carries its stable code", () => {
    expect(new CatalogFetchAuthError("https://x/c.json").code).toBe("catalog-fetch-auth");
  });
});

describe("CatalogFetchError", () => {
  it("says exactly what went wrong", () => {
    const error = new CatalogFetchError("https://x/c.json", "timeout");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "CatalogFetchError",
      message: 'Failed to fetch catalog from "https://x/c.json": timeout',
    });
  });

  it("carries its stable code", () => {
    expect(new CatalogFetchError("https://x/c.json", "timeout").code).toBe("catalog-fetch");
  });
});

describe("CatalogFetchNotFoundError", () => {
  it("says exactly what went wrong", () => {
    const error = new CatalogFetchNotFoundError("https://x/c.json");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "CatalogFetchNotFoundError",
      message: "Catalog not found (HTTP 404): https://x/c.json",
    });
  });

  it("carries its stable code", () => {
    expect(new CatalogFetchNotFoundError("https://x/c.json").code).toBe("catalog-fetch-not-found");
  });
});

describe("HttpError", () => {
  it("says exactly what went wrong", () => {
    const error = new HttpError(500, "https://x");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "HttpError",
      message: "Unexpected HTTP 500 from https://x",
    });
  });

  it("carries its stable code", () => {
    expect(new HttpError(500, "https://x").code).toBe("http");
  });

  it("carries the status code and the URL an HTTP failure came from", () => {
    const error = new HttpError(503, "https://x/y");
    expect({ statusCode: error.statusCode, url: error.url }).toStrictEqual({
      statusCode: 503,
      url: "https://x/y",
    });
  });
});

describe("HttpNotFoundError", () => {
  it("says exactly what went wrong", () => {
    const error = new HttpNotFoundError("https://x");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "HttpNotFoundError",
      message: "Resource not found (HTTP 404): https://x",
    });
  });

  it("carries its stable code", () => {
    expect(new HttpNotFoundError("https://x").code).toBe("http-not-found");
  });

  it("carries the URL a 404 came from", () => {
    expect(new HttpNotFoundError("https://x/y").url).toBe("https://x/y");
  });
});

describe("HttpRedirectError", () => {
  it("includes the URL in the message and sets error name", () => {
    const error = new HttpRedirectError("https://example.com/redirect");
    expect(error.name).toBe("HttpRedirectError");
    expect(error.message).toContain("https://example.com/redirect");
    expect(error.url).toBe("https://example.com/redirect");
  });

  it("says exactly what went wrong", () => {
    const error = new HttpRedirectError("https://x");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "HttpRedirectError",
      message: "HTTP redirect without location header from https://x",
    });
  });

  it("carries its stable code", () => {
    expect(new HttpRedirectError("https://x").code).toBe("http-redirect");
  });
});

describe("InputRequiredError", () => {
  it("carries the provided message", () => {
    const error = new InputRequiredError("Prompt answer is required.");
    expect(error.name).toBe("InputRequiredError");
    expect(error.message).toBe("Prompt answer is required.");
  });

  it("says exactly what went wrong", () => {
    const error = new InputRequiredError("answer needed");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InputRequiredError",
      message: "answer needed",
    });
  });

  it("carries its stable code", () => {
    expect(new InputRequiredError("answer needed").code).toBe("input-required");
  });
});

describe("InvalidInstallScopeError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidInstallScopeError("global");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidInstallScopeError",
      message: "Invalid scope 'global'. Expected 'project' or 'user'.",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidInstallScopeError("global").code).toBe("invalid-install-scope");
  });
});

describe("InvalidMarketplaceNameError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidMarketplaceNameError("My Market");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidMarketplaceNameError",
      message:
        'Invalid marketplace name: "My Market". Use lowercase alphanumeric characters and hyphens only.',
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidMarketplaceNameError("My Market").code).toBe("invalid-marketplace-name");
  });
});

describe("InvalidPluginManifestError", () => {
  it("says exactly what went wrong (1)", () => {
    const error = new InvalidPluginManifestError("name missing");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidPluginManifestError",
      message: "Invalid plugin manifest: name missing",
    });
  });

  it("says exactly what went wrong (2)", () => {
    const error = new InvalidPluginManifestError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidPluginManifestError",
      message: "Invalid plugin manifest.",
    });
  });
});

describe("InvalidPluginSourceError", () => {
  it("says exactly what went wrong (1)", () => {
    const error = new InvalidPluginSourceError("no kind");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidPluginSourceError",
      message: "Invalid plugin source: no kind",
    });
  });

  it("says exactly what went wrong (2)", () => {
    const error = new InvalidPluginSourceError();
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidPluginSourceError",
      message: "Invalid plugin source.",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidPluginSourceError("no kind").code).toBe("invalid-plugin-source");
  });
});

describe("InvalidSourceMarketplaceError", () => {
  it("says exactly what went wrong", () => {
    const error = new InvalidSourceMarketplaceError("no plugins");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "InvalidSourceMarketplaceError",
      message: "Invalid source marketplace: no plugins.",
    });
  });

  it("carries its stable code", () => {
    expect(new InvalidSourceMarketplaceError("no plugins").code).toBe("invalid-source-marketplace");
  });
});

describe("JsonParseError", () => {
  it("includes the path and cause in the message", () => {
    const error = new JsonParseError("/some/file.json", "Unexpected token");
    expect(error.name).toBe("JsonParseError");
    expect(error.message).toContain("/some/file.json");
    expect(error.message).toContain("Unexpected token");
  });

  it("says exactly what went wrong", () => {
    const error = new JsonParseError("/f.json", "Unexpected token");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "JsonParseError",
      message: "Cannot parse existing JSON at /f.json: Unexpected token",
    });
  });

  it("carries its stable code", () => {
    expect(new JsonParseError("/f.json", "Unexpected token").code).toBe("json-parse");
  });
});

describe("ManifestValidationError", () => {
  it("says exactly what went wrong", () => {
    const error = new ManifestValidationError("bad manifest");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "ManifestValidationError",
      message: "bad manifest",
    });
  });

  it("carries its stable code", () => {
    expect(new ManifestValidationError("bad manifest").code).toBe("manifest-validation");
  });
});

describe("McpConfigError", () => {
  it("says exactly what went wrong", () => {
    const error = new McpConfigError("bad mcp");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "McpConfigError",
      message: "bad mcp",
    });
  });

  it("carries its stable code", () => {
    expect(new McpConfigError("bad mcp").code).toBe("mcp-config");
  });
});

describe("ToolNotInManifestError", () => {
  it("says exactly what went wrong", () => {
    const error = new ToolNotInManifestError("zed");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "ToolNotInManifestError",
      message: "Tool 'zed' is not installed in the manifest.",
    });
  });

  it("carries its stable code", () => {
    expect(new ToolNotInManifestError("zed").code).toBe("tool-not-in-manifest");
  });
});

describe("UnreadableUserSourceReferencesError", () => {
  it("says exactly what went wrong", () => {
    const error = new UnreadableUserSourceReferencesError("/refs.json", "EACCES");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UnreadableUserSourceReferencesError",
      message:
        "Cannot read the shared-source reference registry at /refs.json: EACCES. Repair the file, or delete it to start from an empty registry.",
    });
  });

  it("carries its stable code", () => {
    expect(new UnreadableUserSourceReferencesError("/refs.json", "EACCES").code).toBe(
      "unreadable-user-source-references"
    );
  });
});

describe("UnregisteredToolError", () => {
  it("says exactly what went wrong", () => {
    const error = new UnregisteredToolError("zed");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UnregisteredToolError",
      message: "Tool 'zed' is not registered.",
    });
  });

  it("carries its stable code", () => {
    expect(new UnregisteredToolError("zed").code).toBe("unregistered-tool");
  });
});

describe("VersionMismatchError", () => {
  it("says exactly what went wrong", () => {
    const error = new VersionMismatchError("aidd-dev", "1.0.0", "2.0.0");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "VersionMismatchError",
      message:
        "Plugin 'aidd-dev': requested version '1.0.0' does not match catalog version '2.0.0'.",
    });
  });

  it("carries its stable code", () => {
    expect(new VersionMismatchError("aidd-dev", "1.0.0", "2.0.0").code).toBe("version-mismatch");
  });
});

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
  InvalidPluginNameError,
  InvalidPluginSourceError,
  InvalidPluginVersionError,
  InvalidSourceMarketplaceError,
  JsonParseError,
  ManifestValidationError,
  McpConfigError,
  ToolNotInManifestError,
  UnreadableUserSourceReferencesError,
  UnregisteredToolError,
  VersionMismatchError,
} from "../../../src/shared/domain/shared.error.js";

describe("raising an AIDD error", () => {
  class ProbeError extends AiddError {
    readonly code = "probe";
  }

  it("is an Error that carries the stable code its subclass names and no words", () => {
    const error = new ProbeError();
    expect(error).toBeInstanceOf(Error);
    expect({ name: error.name, code: error.code, message: error.message }).toStrictEqual({
      name: "ProbeError",
      code: "probe",
      message: "",
    });
  });

  it("keeps the cause it was raised from", () => {
    const cause = new Error("root");

    expect(new ProbeError({ cause }).cause).toBe(cause);
  });
});

describe("a shared error carries its data and says nothing itself", () => {
  it.each([
    [new AssetNotFoundError("schema.json"), { assetName: "schema.json" }, "asset-not-found"],
    [new AuthenticationError("gh"), { source: "gh" }, "authentication"],
    [
      new CatalogFetchAuthError("https://x/c.json"),
      { url: "https://x/c.json" },
      "catalog-fetch-auth",
    ],
    [
      new CatalogFetchError("https://x/c.json", "timeout"),
      { url: "https://x/c.json", reason: "timeout" },
      "catalog-fetch",
    ],
    [
      new CatalogFetchNotFoundError("https://x/c.json"),
      { url: "https://x/c.json" },
      "catalog-fetch-not-found",
    ],
    [new HttpError(503, "https://x/y"), { statusCode: 503, url: "https://x/y" }, "http"],
    [new HttpNotFoundError("https://x/y"), { url: "https://x/y" }, "http-not-found"],
    [new HttpRedirectError("https://x"), { url: "https://x" }, "http-redirect"],
    [new InputRequiredError("answer needed"), { detail: "answer needed" }, "input-required"],
    [new InvalidInstallScopeError("global"), { value: "global" }, "invalid-install-scope"],
    [
      new InvalidMarketplaceNameError("My Market"),
      { detail: "My Market" },
      "invalid-marketplace-name",
    ],
    [
      new InvalidPluginManifestError("name missing"),
      { detail: "name missing" },
      "invalid-plugin-manifest",
    ],
    [new InvalidPluginManifestError(), { detail: undefined }, "invalid-plugin-manifest"],
    [new InvalidPluginNameError("My Plugin"), { pluginName: "My Plugin" }, "invalid-plugin-name"],
    [new InvalidPluginVersionError("latest"), { version: "latest" }, "invalid-plugin-version"],
    [new InvalidPluginSourceError("no kind"), { detail: "no kind" }, "invalid-plugin-source"],
    [new InvalidPluginSourceError(), { detail: undefined }, "invalid-plugin-source"],
    [
      new InvalidSourceMarketplaceError("no plugins"),
      { detail: "no plugins" },
      "invalid-source-marketplace",
    ],
    [
      new JsonParseError("/f.json", "Unexpected token"),
      { path: "/f.json", reason: "Unexpected token" },
      "json-parse",
    ],
    [
      new ManifestValidationError("bad manifest"),
      { detail: "bad manifest" },
      "manifest-validation",
    ],
    [new McpConfigError("bad mcp"), { detail: "bad mcp" }, "mcp-config"],
    [new ToolNotInManifestError("zed"), { toolId: "zed" }, "tool-not-in-manifest"],
    [
      new UnreadableUserSourceReferencesError("/refs.json", "EACCES"),
      { path: "/refs.json", reason: "EACCES" },
      "unreadable-user-source-references",
    ],
    [new UnregisteredToolError("zed"), { toolId: "zed" }, "unregistered-tool"],
    [
      new VersionMismatchError("aidd-dev", "1.0.0", "2.0.0"),
      { plugin: "aidd-dev", requested: "1.0.0", actual: "2.0.0" },
      "version-mismatch",
    ],
  ])("%s", (error, data, code) => {
    expect(error).toMatchObject({ ...data, message: "", code });
    expect(error.name).toBe(error.constructor.name);
  });
});

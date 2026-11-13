import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import {
  AuthenticationError,
  HttpError,
  HttpRedirectError,
} from "../../../src/shared/domain/errors.js";
import { HttpClient } from "../../../src/shared/infrastructure/http-client.js";

function startServer(handler: (req: IncomingMessage, res: ServerResponse) => void) {
  const server = createServer(handler);
  return new Promise<{ url: string; close: () => Promise<void> }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

async function against<T>(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
  run: (url: string) => Promise<T>
): Promise<T> {
  const { url, close } = await startServer(handler);
  try {
    return await run(url);
  } finally {
    await close();
  }
}

describe("HttpClient", () => {
  it("sends GET, the path with its query, and the GitHub headers by default", async () => {
    let seen: Record<string, string | undefined> = {};
    await against(
      (req, res) => {
        seen = {
          method: req.method,
          url: req.url,
          agent: req.headers["user-agent"],
          accept: req.headers.accept,
          auth: req.headers.authorization,
        };
        res.end();
      },
      (url) => new HttpClient().get(`${url}/a/b?c=1`)
    );
    expect(seen).toStrictEqual({
      method: "GET",
      url: "/a/b?c=1",
      agent: "aidd-cli",
      accept: "application/vnd.github+json",
      auth: undefined,
    });
  });

  it("sends the token as a bearer header", async () => {
    let auth: string | undefined;
    await against(
      (req, res) => {
        auth = req.headers.authorization;
        res.end();
      },
      (url) => new HttpClient().get(url, { token: "my-secret-token" })
    );
    expect(auth).toBe("Bearer my-secret-token");
  });

  it("parses a JSON body", async () => {
    const response = await against(
      (_req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ tag_name: "v1.0.0" }));
      },
      (url) => new HttpClient().get(url)
    );
    expect(response).toStrictEqual({
      body: { tag_name: "v1.0.0" },
      statusCode: 200,
      contentType: "application/json",
    });
  });

  it("answers an empty content type and the raw bytes when the server names none", async () => {
    const response = await against(
      (_req, res) => res.end("raw"),
      (url) => new HttpClient().get(url)
    );
    expect(Buffer.isBuffer(response.body)).toBe(true);
    expect({ ...response, body: String(response.body) }).toStrictEqual({
      body: "raw",
      statusCode: 200,
      contentType: "",
    });
  });

  it.each([301, 302])("follows a %i to its destination", async (code) => {
    const target = await startServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ moved: true }));
    });
    try {
      const response = await against(
        (_req, res) => {
          res.writeHead(code, { Location: target.url });
          res.end();
        },
        (url) => new HttpClient().get(url)
      );
      expect(response.body).toStrictEqual({ moved: true });
    } finally {
      await target.close();
    }
  });

  it("refuses a redirect that names no destination", async () => {
    await against(
      (_req, res) => {
        res.writeHead(302);
        res.end();
      },
      (url) => expect(new HttpClient().get(url)).rejects.toThrow(new HttpRedirectError(url))
    );
  });

  it.each([401, 403])("reports %i as an authentication failure", async (code) => {
    await against(
      (_req, res) => {
        res.writeHead(code);
        res.end();
      },
      (url) =>
        expect(new HttpClient().get(url)).rejects.toThrow(new AuthenticationError(`HTTP ${code}`))
    );
  });

  it("reports not found when the resource does not exist", async () => {
    await against(
      (_req, res) => {
        res.writeHead(404);
        res.end();
      },
      (url) => expect(new HttpClient().get(url)).rejects.toThrow("Resource not found (HTTP 404)")
    );
  });

  it("reports HTTP 300 as unexpected, the first code past success", async () => {
    await against(
      (_req, res) => {
        res.writeHead(300);
        res.end();
      },
      (url) => expect(new HttpClient().get(url)).rejects.toThrow(new HttpError(300, url))
    );
  });

  it("speaks TLS to an https address", async () => {
    await against(
      (_req, res) => res.end(),
      (url) => expect(new HttpClient().get(url.replace("http:", "https:"))).rejects.toThrow()
    );
  });

  it("rejects when the connection drops in the middle of the body", async () => {
    await against(
      (_req, res) => {
        res.writeHead(200, { "Content-Length": "10" });
        res.write("abc", () => res.socket?.destroy());
      },
      (url) => expect(new HttpClient().get(url)).rejects.toThrow()
    );
  });
});

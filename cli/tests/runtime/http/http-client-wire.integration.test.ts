import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { HttpError, HttpRedirectError } from "../../../src/kernel/errors.js";
import { HttpClient } from "../../../src/runtime/http/http-client.js";

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

describe("HttpClient, on the wire", () => {
  it("sends GET, the path with its query, and the GitHub headers by default", async () => {
    let seen: { method?: string; url?: string; agent?: string; accept?: string } = {};
    const { url, close } = await startServer((req, res) => {
      seen = {
        method: req.method,
        url: req.url,
        agent: req.headers["user-agent"],
        accept: req.headers.accept,
      };
      res.writeHead(200);
      res.end();
    });
    try {
      await new HttpClient().get(`${url}/a/b?c=1`);
      expect(seen).toStrictEqual({
        method: "GET",
        url: "/a/b?c=1",
        agent: "aidd-cli",
        accept: "application/vnd.github+json",
      });
    } finally {
      await close();
    }
  });

  it("answers an empty content type and the raw bytes when the server names none", async () => {
    const { url, close } = await startServer((_req, res) => {
      res.writeHead(200);
      res.end("raw");
    });
    try {
      const response = await new HttpClient().get(url);
      expect({ ...response, body: String(response.body) }).toStrictEqual({
        body: "raw",
        statusCode: 200,
        contentType: "",
      });
    } finally {
      await close();
    }
  });

  it("follows a 301 as it follows a 302", async () => {
    const target = await startServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ moved: true }));
    });
    const { url, close } = await startServer((_req, res) => {
      res.writeHead(301, { Location: target.url });
      res.end();
    });
    try {
      expect((await new HttpClient().get(url)).body).toStrictEqual({ moved: true });
    } finally {
      await close();
      await target.close();
    }
  });

  it("refuses a redirect that names no destination", async () => {
    const { url, close } = await startServer((_req, res) => {
      res.writeHead(302);
      res.end();
    });
    try {
      await expect(new HttpClient().get(url)).rejects.toThrow(new HttpRedirectError(url));
    } finally {
      await close();
    }
  });

  it("reports HTTP 300 as unexpected, the first code past success", async () => {
    const { url, close } = await startServer((_req, res) => {
      res.writeHead(300);
      res.end();
    });
    try {
      await expect(new HttpClient().get(url)).rejects.toThrow(new HttpError(300, url));
    } finally {
      await close();
    }
  });
});

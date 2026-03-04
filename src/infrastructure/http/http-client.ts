import type { IncomingMessage } from "node:http";
import * as http from "node:http";
import * as https from "node:https";

export interface HttpGetOptions {
  token?: string;
}

export interface HttpResponse {
  body: Buffer | unknown;
  statusCode: number;
  contentType: string;
}

function collectBuffer(response: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    response.on("data", (chunk: Buffer) => chunks.push(chunk));
    response.on("end", () => resolve(Buffer.concat(chunks)));
    response.on("error", reject);
  });
}

function buildHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": "aidd-cli",
    Accept: "application/vnd.github+json, application/octet-stream, */*",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function doGet(url: string, token?: string): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === "https:" ? https : http;
    const req = transport.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || undefined,
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers: buildHeaders(token),
      },
      resolve
    );
    req.on("error", reject);
    req.end();
  });
}

export class HttpClient {
  async get(url: string, options?: HttpGetOptions): Promise<HttpResponse> {
    const response = await doGet(url, options?.token);
    const statusCode = response.statusCode ?? 0;

    if (statusCode === 302 || statusCode === 301) {
      const location = response.headers.location;
      if (!location) {
        throw new Error(`HTTP redirect without location header from ${url}`);
      }
      // Consume the body to free the socket
      await collectBuffer(response);
      const redirected = await doGet(location, options?.token);
      return this.parseResponse(redirected, location);
    }

    return this.parseResponse(response, url);
  }

  private async parseResponse(response: IncomingMessage, url: string): Promise<HttpResponse> {
    const statusCode = response.statusCode ?? 0;
    const contentType = response.headers["content-type"] ?? "";

    if (statusCode === 401 || statusCode === 403) {
      await collectBuffer(response);
      throw new Error(
        `Authentication failed (HTTP ${statusCode}). Provide a valid token via --token or AIDD_TOKEN.`
      );
    }

    if (statusCode === 404) {
      await collectBuffer(response);
      throw new Error(`Resource not found (HTTP 404): ${url}`);
    }

    if (statusCode < 200 || statusCode >= 300) {
      await collectBuffer(response);
      throw new Error(`Unexpected HTTP ${statusCode} from ${url}`);
    }

    const buffer = await collectBuffer(response);

    if (contentType.includes("application/json")) {
      const text = buffer.toString("utf-8");
      return { body: JSON.parse(text) as unknown, statusCode, contentType };
    }

    return { body: buffer, statusCode, contentType };
  }
}

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  CATALOG_PATH,
  HEAD_CATALOG,
  PRIVATE_REPO,
  PUBLIC_REPO,
  STABLE_CATALOG,
  STABLE_REF,
} from "./raw-catalog.contract.js";
import { RATE_LIMITED_REPO, VISIBLE_REPO } from "./repository-visibility.contract.js";

const CONTENTS = /^\/repos\/(.+?)\/contents\/(.+)$/;
const REPOSITORY = /^\/repos\/(.+)$/;

function answer(res: ServerResponse, status: number, body = ""): void {
  res.writeHead(status, { "content-type": "text/plain" });
  res.end(body);
}

function catalogOf(repo: string, path: string, ref: string | null): [number, string] {
  if (repo === PRIVATE_REPO) return [401, ""];
  if (repo !== PUBLIC_REPO || path !== CATALOG_PATH) return [404, ""];
  if (ref === "HEAD") return [200, HEAD_CATALOG];
  return ref === STABLE_REF ? [200, STABLE_CATALOG] : [404, ""];
}

function visibilityOf(repo: string): number {
  if (repo === VISIBLE_REPO) return 200;
  return repo === RATE_LIMITED_REPO ? 403 : 404;
}

function serveContents(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const found = CONTENTS.exec(url.pathname);
  if (found) {
    const [status, body] = catalogOf(found[1] ?? "", found[2] ?? "", url.searchParams.get("ref"));
    answer(res, status, body);
    return;
  }
  const repository = REPOSITORY.exec(url.pathname);
  answer(res, repository ? visibilityOf(repository[1] ?? "") : 404, repository ? "{}" : "");
}

/** A GitHub contents API on a free local port, serving the contracts' worlds. */
export function startLocalGitHub(): Promise<{ apiBase: string; close: () => Promise<void> }> {
  const server = createServer(serveContents);
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("the local GitHub is not listening on a port"));
        return;
      }
      resolve({
        apiBase: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

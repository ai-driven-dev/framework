import { plainObjectIn } from "../../../../shared/domain/reading/plain-object.js";

/** What a host's plugin server answered: its data, or the code and words it refused with. */
export type ServerReply =
  | { readonly kind: "answered"; readonly data: unknown }
  | { readonly kind: "refused"; readonly code: number; readonly detail: string };

/** The reply to one call. The server answers `{ code, msg, data }` and a zero code is success, on
 * an HTTP 200 as often as not, so the body decides and the status only names a reply with none. */
export function serverReplyOf(status: number, body: string): ServerReply {
  const reply = plainObjectIn(body);
  if (reply === null || typeof reply.code !== "number") {
    return { kind: "refused", code: status, detail: `unreadable reply (HTTP ${status})` };
  }
  if (reply.code === 0) return { kind: "answered", data: reply.data };
  return {
    kind: "refused",
    code: reply.code,
    detail: typeof reply.msg === "string" ? reply.msg : `refused with code ${reply.code}`,
  };
}

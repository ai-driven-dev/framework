import { createServer } from "node:http";

export type KiloChatMessage = {
  role: string;
  content: unknown;
  name?: string;
  tool_call_id?: string;
};

export type KiloChatTool = {
  type?: string;
  function: {
    name: string;
    parameters?: unknown;
  };
};

export type KiloChatRequest = {
  messages: KiloChatMessage[];
  tools?: KiloChatTool[];
};

export type LocalModelReply =
  | { content: string }
  | { toolCall: { id: string; name: string; arguments: Record<string, unknown> } };

type ScriptedLocalModel = {
  respond: (request: KiloChatRequest, requestIndex: number) => LocalModelReply;
};

/** Local deterministic provider; string arguments preserve the original direct-read behavior. */
export async function localModel(
  readPathOrScript: string | ScriptedLocalModel = "probe.txt",
  finalAnswer = "KILO_LOCAL_READ_CONFIRMED"
) {
  const script = typeof readPathOrScript === "string" ? undefined : readPathOrScript;
  const readPath = typeof readPathOrScript === "string" ? readPathOrScript : "probe.txt";
  const requests: KiloChatRequest[] = [];
  const replies: LocalModelReply[] = [];
  let readSent = false;
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += String(chunk);
    });
    request.on("end", () => {
      if (request.url !== "/v1/chat/completions") {
        response.writeHead(404).end();
        return;
      }

      const input = JSON.parse(body) as KiloChatRequest;
      const requestIndex = requests.push(input) - 1;
      let reply: LocalModelReply;
      if (script !== undefined) {
        reply = script.respond(input, requestIndex);
      } else if (!readSent && input.tools?.some((tool) => tool.function.name === "read")) {
        readSent = true;
        reply = {
          toolCall: {
            id: "call_local_read",
            name: "read",
            arguments: { filePath: readPath },
          },
        };
      } else {
        reply = { content: finalAnswer };
      }
      replies.push(reply);

      response.writeHead(200, { "content-type": "text/event-stream" });
      const chunk = (delta: unknown, finish_reason: string | null = null) => {
        response.write(
          `data: ${JSON.stringify({ id: "chatcmpl-local", object: "chat.completion.chunk", created: 1, model: "fake", choices: [{ index: 0, delta, finish_reason }] })}\n\n`
        );
      };
      chunk({ role: "assistant" });
      if ("toolCall" in reply) {
        chunk({
          tool_calls: [
            {
              index: 0,
              id: reply.toolCall.id,
              type: "function",
              function: {
                name: reply.toolCall.name,
                arguments: JSON.stringify(reply.toolCall.arguments),
              },
            },
          ],
        });
        chunk({}, "tool_calls");
      } else {
        chunk({ content: reply.content });
        chunk({}, "stop");
      }
      response.end("data: [DONE]\n\n");
    });
  });
  await new Promise<void>((resolve, reject) => {
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(0, "127.0.0.1");
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Missing model port");
  return {
    server,
    requests,
    replies,
    url: `http://127.0.0.1:${address.port}/v1`,
  };
}

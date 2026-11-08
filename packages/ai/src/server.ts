// Loopback-only bridge: Python rasterizes PDFs; this process owns the Gateway credentials.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";
import { DecisionRequest, decide } from "./decisions";

// Load the root .env.local at runtime only. Never expose it to the browser or print its values.
try {
  loadEnvFile(fileURLToPath(new URL("../../../.env.local", import.meta.url)));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
    console.error("Could not load local configuration.");
    process.exit(1);
  }
}
// Node's fetch does not automatically honour proxy variables on every supported Node release.
// Preserve the cloud runtime's proxy/NO_PROXY and inherited CA trust; never disable TLS checks.
setGlobalDispatcher(new EnvHttpProxyAgent());

const MAX_BODY = 48 * 1024 * 1024;
let active = 0;
function send(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(data));
}
async function handle(req: IncomingMessage, res: ServerResponse) {
  if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true });
  if (req.method !== "POST" || req.url !== "/decisions")
    return send(res, 404, { error: "Not found." });
  // No browser origins/CORS; only a server-side localhost client may spend credits here.
  if (req.headers.origin || req.headers["content-type"] !== "application/json")
    return send(res, 403, { error: "Server requests only." });
  if (active >= 2) return send(res, 429, { error: "Document review is busy. Try again shortly." });
  active++;
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });
  try {
    const chunks: Buffer[] = [];
    let bytes = 0;
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > MAX_BODY) return send(res, 413, { error: "Too many image bytes." });
      chunks.push(chunk);
    }
    let input;
    try {
      input = DecisionRequest.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    } catch {
      return send(res, 400, { error: "Invalid document decision request." });
    }
    if (!process.env.AI_GATEWAY_API_KEY)
      return send(res, 503, {
        error: "Set AI_GATEWAY_API_KEY in the root .env.local and restart the AI service.",
      });
    const decisions = await decide(input, undefined, controller.signal);
    send(res, 200, decisions);
  } catch {
    // SDK errors can contain request bodies, headers and response text. Never relay or log them.
    send(res, 503, {
      error:
        "AI document review is unavailable. Check Gateway access, credits and configuration, then try again.",
    });
  } finally {
    active--;
  }
}

const server = createServer((req, res) => {
  void handle(req, res);
});
server.requestTimeout = 75_000;
server.listen(8101, "127.0.0.1", () =>
  console.info("AI decisions service listening on http://127.0.0.1:8101"),
);

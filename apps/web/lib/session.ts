// Server only: the browser session id (httpOnly cookie) and the proxy to services/review.
import { cookies } from "next/headers";

const COOKIE = "permit_session";
const VALID = /^[a-f0-9]{32}$/;

/** This browser's session id; a new one is created (and set as a cookie) if `create` and none exists. */
export async function sessionId(create: boolean): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get(COOKIE)?.value;
  if (v && VALID.test(v)) return v;
  if (!create) return null;
  const id = crypto.randomUUID().replace(/-/g, "");
  jar.set(COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 24 * 3600 });
  return id;
}

/** Forward to the review service's /sessions/{sid}… endpoint and relay its JSON. */
export async function forward(path: string, init: RequestInit = {}): Promise<Response> {
  const base = process.env.REVIEW_URL ?? "http://localhost:8000";
  try {
    const res = await fetch(`${base}${path}`, { ...init, cache: "no-store" });
    if (!res.ok) {
      const detail = await res.json().then((j: { detail?: unknown }) => j.detail).catch(() => undefined);
      return Response.json({ error: typeof detail === "string" ? detail : `The review service returned ${res.status}.` }, { status: res.status });
    }
    return new Response(await res.text(), { status: 200, headers: { "content-type": "application/json" } });
  } catch {
    return Response.json({ error: "The review service is not running, so the file could not be saved." }, { status: 503 });
  }
}

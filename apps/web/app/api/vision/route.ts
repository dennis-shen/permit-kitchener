// Proxies uploads to the vision service so the browser never needs its address.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const base = process.env.VISION_URL ?? "http://localhost:8000";
  try {
    const res = await fetch(`${base}/review`, { method: "POST", body: await req.formData() });
    return new Response(await res.text(), { status: res.status, headers: { "content-type": "application/json" } });
  } catch {
    return Response.json({ error: "The document reviewer is not available right now." }, { status: 503 });
  }
}

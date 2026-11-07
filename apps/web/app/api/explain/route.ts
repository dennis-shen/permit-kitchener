import { explain } from "@permit/ai";
import { ReadinessReport } from "@permit/schema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = ReadinessReport.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "Invalid report" }, { status: 400 });
  return Response.json(await explain(parsed.data));
}

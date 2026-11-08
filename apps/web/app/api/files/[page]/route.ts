// Save (PUT, multipart `file` + `submission`) or remove (DELETE) the PDF of one document page.
import { DocumentType } from "@permit/schema";
import { forward, sessionId } from "../../../../lib/session";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ page: string }> };

async function pageOf(ctx: Ctx): Promise<string | null> {
  const { page } = await ctx.params;
  return DocumentType.safeParse(page).success ? page : null;
}

export async function PUT(req: Request, ctx: Ctx) {
  const page = await pageOf(ctx);
  if (!page) return Response.json({ error: "Unknown document page." }, { status: 400 });
  const sid = await sessionId(true);
  return forward(`/sessions/${sid}/files/${page}`, { method: "PUT", body: await req.formData() });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const page = await pageOf(ctx);
  if (!page) return Response.json({ error: "Unknown document page." }, { status: 400 });
  const sid = await sessionId(false);
  return sid ? forward(`/sessions/${sid}/files/${page}`, { method: "DELETE" }) : Response.json({ files: [] });
}

// The saved uploads of this browser session (stored by services/review).
import { forward, sessionId } from "../../../lib/session";

export const runtime = "nodejs";

/** Also starts the session (sets the cookie), so later parallel uploads all share one session. */
export async function GET() {
  const sid = await sessionId(true);
  return forward(`/sessions/${sid}/files`);
}

/** Remove every saved file (new application). */
export async function DELETE() {
  const sid = await sessionId(false);
  return sid ? forward(`/sessions/${sid}`, { method: "DELETE" }) : Response.json({ files: [] });
}

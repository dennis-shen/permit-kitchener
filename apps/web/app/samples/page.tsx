"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PROJECT_OPTIONS } from "@permit/engine";
import type { DocumentType } from "@permit/schema";
import { SCENARIOS } from "../../lib/scenarios";
import { loadDemo } from "../../lib/demo";
import { useStore } from "../../lib/store";

const label = (t: string) => PROJECT_OPTIONS.find((o) => o.type === t)?.label ?? t;

/** The InfoPkg sample applications. Not linked from the app; used by the end-to-end tests and for demos. */
export default function Samples() {
  const router = useRouter();
  const { set, reset, upload } = useStore();
  const [busy, setBusy] = useState<string | null>(null);

  async function demo(i: number) {
    const s = SCENARIOS[i]!;
    setBusy(s.application.application_id);
    await reset();
    const { patch, files } = await loadDemo(s);
    set(patch);
    // save each sample PDF on the server, like a real upload
    const ctx = { application: s.application, projectType: s.application.project_type, answers: patch.answers ?? {} };
    for (const [page, f] of Object.entries(files)) await upload(page as DocumentType, f!, ctx);
    router.push("/requirements");
  }

  return (
    <>
      <h1>Sample applications</h1>
      <p className="muted">Load a sample application (fictional data) to see how the check works.</p>
      <div className="grid three">
        {SCENARIOS.map((s, i) => (
          <div className="card" key={s.application.application_id}>
            <h3>{s.title}</h3>
            <p className="muted" style={{ margin: "4px 0 12px", fontSize: 15 }}>
              {label(s.application.project_type)} · {s.application.property_address}
            </p>
            <button className="btn small secondary" onClick={() => demo(i)} disabled={!!busy}>
              {busy === s.application.application_id ? "Loading…" : "Load sample"}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

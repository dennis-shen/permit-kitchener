"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PROJECT_OPTIONS } from "@permit/engine";
import type { DocumentType } from "@permit/schema";
import { SCENARIOS } from "../lib/scenarios";
import { loadDemo } from "../lib/demo";
import { useStore } from "../lib/store";

const label = (t: string) => PROJECT_OPTIONS.find((o) => o.type === t)?.label ?? t;

export default function Home() {
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
      <div className="hero">
        <h1>Check your building permit application before you submit it</h1>
        <p className="lead">
          Find out what your project needs, upload your forms and drawings, and see what is missing and where to add it,
          so you can submit a complete application the first time.
        </p>
        <button type="button" className="btn" onClick={async () => { await reset(); router.push("/project"); }}>Start</button>
      </div>

      <ol className="steps-list" aria-label="How it works">
        <li><strong>Choose your project</strong><br />Pick or type the kind of work you are planning.</li>
        <li><strong>Preview</strong><br />A few questions tell you whether a permit is likely needed.</li>
        <li><strong>Application and documents</strong><br />Enter your details, then upload each PDF on its own page. We check each one automatically.</li>
        <li><strong>Declare, review and download</strong><br />Sign the declaration, see anything unfinished, and download a PDF summary.</li>
      </ol>

      <h2>Sample applications</h2>
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

"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PROJECT_OPTIONS } from "@permit/engine";
import { SCENARIOS } from "../lib/scenarios";
import { loadDemo } from "../lib/demo";
import { useStore } from "../lib/store";

const label = (t: string) => PROJECT_OPTIONS.find((o) => o.type === t)?.label ?? t;

export default function Home() {
  const router = useRouter();
  const { set, reset, setFiles } = useStore();
  const [busy, setBusy] = useState<string | null>(null);

  async function demo(i: number) {
    const s = SCENARIOS[i]!;
    setBusy(s.application.application_id);
    reset();
    const { patch, files } = await loadDemo(s);
    set(patch);
    setFiles(files);
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
        <a className="btn" href="/project" onClick={() => reset()}>Start</a>
      </div>

      <ol className="steps-list" aria-label="How it works">
        <li><strong>Choose your project</strong><br />Pick or type the kind of work you are planning.</li>
        <li><strong>Enter application details</strong><br />The same information you put on the permit application form.</li>
        <li><strong>Answer a few questions, then upload</strong><br />We tell you if a permit is likely needed and list each requirement with its own upload.</li>
        <li><strong>Get your results and summary</strong><br />See what is missing, where to add it, and download a PDF summary.</li>
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

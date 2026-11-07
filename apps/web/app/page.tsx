"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TYPE_LABELS } from "@permit/engine";
import { SCENARIOS } from "../lib/scenarios";
import { loadDemo } from "../lib/demo";
import { useStore } from "../lib/store";

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
    router.push("/check");
  }

  return (
    <>
      <h1>Get your building permit application right the first time</h1>
      <p className="lead">
        Answer a few questions, get a checklist for your project, then upload your drawings. We read them and point out
        what looks missing, unclear or inconsistent, and show you where to fix it.
      </p>
      <div className="grid two">
        <div className="card">
          <h3>1. Tell us about your project</h3>
          <p className="muted">Plain-language questions work out your project type and whether a permit is likely needed.</p>
        </div>
        <div className="card">
          <h3>2. Get your checklist</h3>
          <p className="muted">Every item links to the official City of Kitchener page.</p>
        </div>
        <div className="card">
          <h3>3. Check your documents</h3>
          <p className="muted">We read your forms and drawings and highlight the exact spot that needs attention.</p>
        </div>
      </div>
      <p className="row" style={{ marginTop: 20 }}>
        <a className="btn" href="/classify" onClick={() => reset()}>Start my project</a>
      </p>

      <h2>Try a demo application</h2>
      <p className="muted">
        These are the fictional CommuniHacks test applications. Each loads its sample drawings so you can run a review.
      </p>
      <div className="grid two">
        {SCENARIOS.map((s, i) => (
          <div className="card" key={s.application.application_id}>
            <h3>{s.title}</h3>
            <p className="muted" style={{ margin: "4px 0 10px", fontSize: 14 }}>
              {s.application.application_id} · {TYPE_LABELS[s.application.project_type]} · {s.application.property_address}
            </p>
            <button className="btn small secondary" onClick={() => demo(i)} disabled={!!busy}>
              {busy === s.application.application_id ? "Loading…" : "Load this demo"}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

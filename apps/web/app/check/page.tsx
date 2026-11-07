"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buildChecklist, answersToFacts, TYPE_LABELS, unknownProjectReport } from "@permit/engine";
import { precheckFiles, reviewFiles } from "@permit/files";
import type { ApplicationInfo, Finding, SubmittedDocument } from "@permit/schema";
import { useStore } from "../../lib/store";
import { buildReport, EMPTY_APPLICATION, type ReviewState } from "../../lib/merge";
import { DOC_LABELS } from "../../lib/labels";

export default function CheckPage() {
  const router = useRouter();
  const { state, set, files, setFiles } = useStore();
  const type = state.review?.application.project_type ?? state.classification?.projectType ?? null;
  const [app, setApp] = useState<ApplicationInfo>(state.review?.application ?? EMPTY_APPLICATION(type));
  const [prechecks, setPrechecks] = useState<Finding[]>([]);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState<Record<string, boolean>>({});
  const [manualMode, setManualMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { if (state.review?.application) setApp(state.review.application); }, [state.review?.application]);
  useEffect(() => {
    precheckFiles(files.map((f) => ({ name: f.name, bytes: f.bytes }))).then(setPrechecks);
  }, [files]);

  if (!type) {
    return (<><h1>Check your documents</h1><p>Tell us about your project first.</p><a className="btn" href="/classify">Start</a></>);
  }
  const attrs = { ...answersToFacts(state.answers), ...(state.review?.attributes ?? {}) } as Record<string, number | boolean | string>;
  for (const k of Object.keys(attrs)) if (attrs[k] === undefined) delete attrs[k];
  const checklist = buildChecklist(type, attrs);

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const added = await Promise.all([...list].map(async (f) => ({ name: f.name, type: f.type, bytes: new Uint8Array(await f.arrayBuffer()) })));
    setFiles([...files, ...added]);
  }

  function base(): ReviewState {
    return {
      application: { ...app, project_type: type! },
      attributes: attrs,
      vision: null,
      prechecks,
      manualDocs: [],
      overrides: [],
      unusualAspects: state.classification?.unusualAspects ?? [],
    };
  }

  async function runReview() {
    setBusy(true);
    setError(null);
    const res = await reviewFiles(
      files.map((f) => ({ name: f.name, bytes: f.bytes, mimeType: f.type })),
      { application: { ...app, project_type: type! }, project_attributes: attrs },
    );
    setBusy(false);
    if (res.visionUnavailable) {
      setError("We couldn't read your files automatically right now. Tick what your drawings show below instead.");
      setManualMode(true);
      return;
    }
    const review: ReviewState = { ...base(), vision: res };
    set({ review, report: buildReport(review).report });
    router.push("/results");
  }

  function runManual() {
    const docs = new Map<string, SubmittedDocument>();
    for (const it of checklist) {
      if (it.requirementId === "general.application") continue;
      const shown = it.details.filter((d) => manual[d.id]).map((d) => d.id);
      const has = manual[`doc:${it.requirementId}`] || shown.length > 0;
      if (!has) continue;
      const key = it.documentType;
      const prev = docs.get(key);
      docs.set(key, { filename: `${DOC_LABELS[key] ?? key} (declared)`, document_type: it.documentType, present: true,
        shown_details: [...(prev?.shown_details ?? []), ...shown] });
    }
    const review: ReviewState = { ...base(), manualDocs: [...docs.values()] };
    set({ review, report: type ? buildReport(review).report : unknownProjectReport(app.application_id) });
    router.push("/results");
  }

  const field = (k: keyof ApplicationInfo, label: string, typeAttr = "text") => (
    <label className="field">
      {label}
      <input type={typeAttr} value={String(app[k] ?? "")}
        onChange={(e) => setApp({ ...app, [k]: typeAttr === "number" ? Number(e.target.value) : e.target.value })} />
    </label>
  );

  return (
    <>
      <h1>Check your documents</h1>
      <p className="lead">{TYPE_LABELS[type]}{state.demoId ? ` · demo ${state.demoId}` : ""}</p>

      <h2>Application information</h2>
      <div className="card grid two">
        {field("applicant_name", "Applicant name")}
        {field("property_address", "Property address")}
        {field("applicant_role", "Your role (owner, tenant, contractor…)")}
        {field("estimated_construction_value", "Estimated construction value ($)", "number")}
        {field("submission_date", "Application date", "date")}
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          Project description
          <textarea rows={3} value={app.project_description} onChange={(e) => setApp({ ...app, project_description: e.target.value })} />
          <span className="help">Describe all the work, including anything you will remove or change.</span>
        </label>
        <label className="choice"><input type="checkbox" checked={app.declaration_completed} onChange={(e) => setApp({ ...app, declaration_completed: e.target.checked })} /> I completed the applicant declaration</label>
        <label className="choice"><input type="checkbox" checked={app.signature_present} onChange={(e) => setApp({ ...app, signature_present: e.target.checked })} /> I signed the application form</label>
      </div>

      <h2>Upload your forms and drawings</h2>
      <div className={`drop ${over ? "over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void addFiles(e.dataTransfer.files); }}>
        <p style={{ margin: 0 }}>Drag PDFs here, or</p>
        <button className="btn secondary small" onClick={() => input.current?.click()} style={{ marginTop: 8 }}>Choose files</button>
        <input ref={input} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.docx" className="sr" onChange={(e) => void addFiles(e.target.files)} aria-label="Choose files" />
        <p className="help" style={{ marginBottom: 0 }}>PDF works best. Scans and photos are read with OCR. Files stay in your browser session and are not stored.</p>
      </div>
      {files.length > 0 && (
        <ul className="files">
          {files.map((f, i) => {
            const issues = prechecks.filter((p) => p.evidence[0]?.filename === f.name);
            return (
              <li key={f.name + i}>
                <span>
                  📄 {f.name} <span className="muted">({Math.ceil(f.bytes.byteLength / 1024)} KB)</span>
                  {issues.map((p) => <span key={p.id} className={`chip ${p.category}`} style={{ marginLeft: 6 }}>⚠ {p.message}</span>)}
                </span>
                <button className="btn small secondary" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`}>Remove</button>
              </li>
            );
          })}
        </ul>
      )}

      {error && <div className="banner warn" role="alert" style={{ marginTop: 16 }}><span className="icon" aria-hidden>⚠</span><div><strong>Automatic reading unavailable</strong><p>{error}</p></div></div>}

      <p className="row" style={{ marginTop: 16 }}>
        <button className="btn" disabled={busy || files.length === 0} onClick={runReview}>{busy ? "Reading your documents…" : "Review my documents"}</button>
        <button className="btn secondary" onClick={() => setManualMode((m) => !m)}>{manualMode ? "Hide manual checklist" : "No files? Tick what you have"}</button>
      </p>
      {busy && <p role="status" className="muted">Reading text, checking signatures and comparing your drawings. This can take up to a minute for scans.</p>}

      {manualMode && (
        <>
          <h2>What do your documents show?</h2>
          <div className="grid">
            {checklist.filter((c) => c.requirementId !== "general.application").map((it) => (
              <fieldset className="card" key={it.requirementId} style={{ border: "1px solid var(--border)" }}>
                <legend><strong>{it.label}</strong></legend>
                <label className="choice"><input type="checkbox" checked={!!manual[`doc:${it.requirementId}`]} onChange={(e) => setManual({ ...manual, [`doc:${it.requirementId}`]: e.target.checked })} /> I have this document</label>
                {it.details.map((d) => (
                  <label key={d.id} style={{ display: "block", marginTop: 6 }}>
                    <input type="checkbox" checked={!!manual[d.id]} onChange={(e) => setManual({ ...manual, [d.id]: e.target.checked })} /> It shows: {d.label}
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
          <p style={{ marginTop: 16 }}><button className="btn" onClick={runManual}>Check my answers</button></p>
        </>
      )}
    </>
  );
}

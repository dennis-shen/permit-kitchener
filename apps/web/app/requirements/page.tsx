"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  allQuestionsAnswered, buildChecklist, factsFromAnswers, permitExplanation, permitRequired, PROJECT_OPTIONS, questionsFor,
  unusualFromAnswers, DOCUMENT_LABELS,
} from "@permit/engine";
import { precheckFiles, reviewFiles } from "@permit/files";
import type { Finding, SubmittedDocument } from "@permit/schema";
import { OTHER_SLOT, useStore, type UploadedFile } from "../../lib/store";
import type { ReviewState } from "../../lib/merge";
import { Questions } from "../../components/Questions";
import { UploadSlot } from "../../components/UploadSlot";
import { StepFooter } from "../../components/StepFooter";

export default function RequirementsPage() {
  const router = useRouter();
  const { state, set, hydrated, files, setFiles } = useStore();
  const [prechecks, setPrechecks] = useState<Finding[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const type = state.projectType;

  const all = useMemo(() => Object.values(files).flat(), [files]);
  useEffect(() => { precheckFiles(all.map((f) => ({ name: f.name, bytes: f.bytes }))).then(setPrechecks); }, [all]);

  if (!hydrated) return null;
  if (!type || !state.application) {
    return (<><h1>Requirements and uploads</h1><p>Choose your project and enter the application details first.</p><a className="btn" href="/project">Start</a></>);
  }
  const project = PROJECT_OPTIONS.find((o) => o.type === type)!;
  const questions = questionsFor(type);
  const answered = allQuestionsAnswered(type, state.answers);
  const facts = factsFromAnswers(type, state.answers);
  const permit = permitRequired(type, facts);
  const unusual = unusualFromAnswers(type, state.answers);
  const checklist = buildChecklist(type, facts);
  const showChecklist = answered && permit !== false;
  const docTypeOf = (slot: string) => checklist.find((c) => c.requirementId === slot)?.documentType;
  const sharedTypes = new Set(checklist.map((c) => c.documentType).filter((t, i, a) => a.indexOf(t) !== i));

  const setSlot = (slot: string, f: UploadedFile[]) => setFiles({ ...files, [slot]: f });
  const tick = (id: string, on: boolean) => set({ checks: { ...state.checks, [id]: on } });

  function baseReview(): ReviewState {
    return {
      application: state.application!, attributes: facts as Record<string, number | boolean | string>, vision: null, prechecks,
      manualDocs: [], overrides: [], unusualAspects: unusual, permitRequired: permit,
    };
  }

  /** Without automatic reading, each slot that has files or ticks counts as a document showing the ticked details. */
  function manualDocs(): SubmittedDocument[] {
    return checklist.filter((c) => c.requirementId !== "general.application").flatMap((c) => {
      const slotFiles = files[c.requirementId] ?? [];
      const shown = c.details.filter((d) => state.checks[d.id]).map((d) => d.id);
      if (!slotFiles.length && !shown.length) return [];
      return [{ filename: slotFiles[0]?.name ?? `${c.label} (declared)`, document_type: c.documentType, present: true, shown_details: shown }];
    });
  }

  function continueWithTicks() {
    set({ review: { ...baseReview(), manualDocs: manualDocs() } });
    router.push("/results");
  }

  async function next() {
    if (permit === false) {
      set({ review: { ...baseReview(), permitRequired: false } });
      router.push("/results");
      return;
    }
    setError(null);
    if (all.length === 0) {
      const review = { ...baseReview(), manualDocs: manualDocs() };
      set({ review });
      router.push("/results");
      return;
    }
    setBusy(true);
    const hints: Record<string, string> = {};
    const upload = Object.entries(files).flatMap(([slot, fs]) => fs.map((f) => {
      const t = docTypeOf(slot);
      if (t && slot !== OTHER_SLOT) hints[f.name] = t;
      return { name: f.name, bytes: f.bytes, mimeType: f.type };
    }));
    const res = await reviewFiles(upload, { application: state.application!, project_attributes: facts as Record<string, number | boolean | string>, document_hints: hints as never });
    setBusy(false);
    if (res.visionUnavailable) {
      setError("We couldn't read your files automatically right now. Tick what each document shows in the checklist, then continue again. Your results will be based on your ticks.");
      const review = { ...baseReview(), manualDocs: manualDocs(), visionError: res.reason };
      set({ review });
      return;
    }
    const review: ReviewState = { ...baseReview(), vision: res };
    set({ review });
    router.push("/results");
  }

  return (
    <>
      <h1>Requirements and uploads</h1>
      <p className="lead">{project.label} · {state.application.property_address || "address not entered"}</p>

      <h2 id="q-head">First, a few questions</h2>
      <p className="muted">Your answers decide whether a permit is likely needed and which items apply to your project.</p>
      <Questions questions={questions} answers={state.answers}
        onChange={(id, a) => { const next = { ...state.answers }; if (a === undefined) delete next[id]; else next[id] = a; set({ answers: next, review: null }); }} />

      {!answered && <p className="muted" role="status" style={{ marginTop: 16 }}>Answer every question above to see your checklist.</p>}

      {answered && permit === false && (
        <div className="banner ok" role="status" style={{ marginTop: 20 }}>
          <span className="icon" aria-hidden>✓</span>
          <div>
            <strong>A permit may not be required</strong>
            <p>{permitExplanation(type)} Based on your answers, you don&apos;t need to upload documents.</p>
            <p>Other rules (such as zoning) may still apply. Confirm with the City before you start: <a href="https://www.kitchener.ca/building-and-renovating/residential-building-permits/">Residential building permits</a>.</p>
          </div>
        </div>
      )}
      {answered && permit === "unknown" && (
        <div className="banner info" role="status" style={{ marginTop: 20 }}>
          <span className="icon" aria-hidden>i</span>
          <div><strong>We can&apos;t tell yet whether a permit is required</strong><p>{permitExplanation(type)} We&apos;ve shown the full checklist so you can prepare. Confirm with the City.</p></div>
        </div>
      )}
      {answered && unusual.length > 0 && (
        <div className="banner info" role="status" style={{ marginTop: 20 }}>
          <span className="icon" aria-hidden>i</span>
          <div><strong>Staff guidance recommended</strong><p>{unusual.join(", ")} is not covered by the simplified checklist. Contact the City&apos;s Building Division about this part of your project.</p></div>
        </div>
      )}

      {showChecklist && (
        <section aria-labelledby="cl-head">
          <h2 id="cl-head">Your checklist</h2>
          <p className="muted">Each requirement has its own upload on the right. Tick items as you prepare them. When you continue, we read your files and check them.</p>
          {error && (
            <div className="banner warn" role="alert">
              <span className="icon" aria-hidden>!</span>
              <div>
                <strong>Automatic reading unavailable</strong><p>{error}</p>
                <p><button className="btn small" onClick={continueWithTicks}>Continue with my ticks</button></p>
              </div>
            </div>
          )}
          <div className="req-columns-head" aria-hidden><span>Requirement</span><span>Upload</span></div>
          {checklist.map((c) => (
            <div className="req-row" key={c.requirementId} data-requirement={c.requirementId}>
              <div className="req-left">
                <h3>{c.label}</h3>
                <p style={{ margin: "0 0 4px" }}>{c.plainLanguage}</p>
                <p className="muted" style={{ margin: 0, fontSize: 15 }}>Goes on: {DOCUMENT_LABELS[c.documentType] ?? c.documentType}</p>
                {c.details.length > 0 && (
                  <ul className="details" aria-label={`${c.label} must show`}>
                    {c.details.map((d) => (
                      <li key={d.id}>
                        <label className="check">
                          <input type="checkbox" checked={!!state.checks[d.id]} onChange={(e) => tick(d.id, e.target.checked)} />
                          <span>{d.label}<span className="where">{d.whereToAdd}</span></span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                {c.links.length > 0 && (
                  <>
                    <strong style={{ fontSize: 15 }}>Where to find guidance</strong>
                    <ul className="links">{c.links.map((l) => <li key={l.url + l.label}><a href={l.url} target="_blank" rel="noreferrer">{l.label}</a></li>)}</ul>
                  </>
                )}
              </div>
              <div className="req-right">
                <UploadSlot id={c.requirementId} label={DOCUMENT_LABELS[c.documentType] ?? c.label} files={files[c.requirementId] ?? []} prechecks={prechecks}
                  onChange={(f) => setSlot(c.requirementId, f)}
                  note={c.alsoAcceptedIn.length || sharedTypes.has(c.documentType) ? "Already shown on another file you uploaded? You can leave this empty; we check related documents too." : undefined} />
              </div>
            </div>
          ))}
          <div className="req-row" data-requirement={OTHER_SLOT}>
            <div className="req-left">
              <h3>Other supporting documents</h3>
              <p style={{ margin: 0 }}>Anything else that supports your application, such as specifications or sketches. We work out what each file is.</p>
            </div>
            <div className="req-right">
              <UploadSlot id={OTHER_SLOT} label="Other documents" files={files[OTHER_SLOT] ?? []} prechecks={prechecks} onChange={(f) => setSlot(OTHER_SLOT, f)} />
            </div>
          </div>
        </section>
      )}

      {busy && <p role="status" className="muted">Reading your documents: text, signatures and drawing details. Scans can take up to a minute.</p>}
      <StepFooter back="/application" onContinue={next} continueDisabled={!answered}
        continueLabel={permit === false ? "Continue" : all.length ? "Check my documents" : "Continue"} busy={busy} />
    </>
  );
}

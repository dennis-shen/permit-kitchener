"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { documentPages, PROJECT_OPTIONS } from "@permit/engine";
import type { DocumentType } from "@permit/schema";
import { useStore, useVisit, type UploadedFile } from "../../lib/store";
import { checkPage, factsFor, fileFindings, pageChecks, pageComplete, type DetailCheck } from "../../lib/review";
import { Viewer } from "../../components/Viewer";
import { ExtLink } from "../../components/ExtLink";

const ICON: Record<DetailCheck["state"], [string, string, string]> = {
  found: ["ok", "✓", "Found"],
  from_application: ["ok", "✓", "From your application details"],
  at_declaration: ["wait", "…", "Confirmed in the Declaration step"],
  not_found: ["no", "✗", "Not found"],
  missing_from_application: ["no", "✗", "Missing from your application details"],
  pending: ["wait", "–", "Upload the PDF to check"],
};

export default function RequirementsPage() {
  useVisit("/requirements");
  const router = useRouter();
  const { state, hydrated, files, setFile, reviews, setReview } = useStore();
  const [index, setIndex] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState<null | (() => void)>(null);
  const [showWhere, setShowWhere] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const running = useRef(new Set<string>());

  const type = state.projectType;
  const facts = type ? factsFor(type, state.answers) : {};
  const pages = type ? documentPages(type, facts) : [];
  const page = pages[Math.min(index, Math.max(pages.length - 1, 0))];

  // deep link: /requirements?page=<document type>
  useEffect(() => {
    if (!pages.length) return;
    const want = new URLSearchParams(window.location.search).get("page");
    const i = pages.findIndex((p) => p.documentType === want);
    if (i >= 0) setIndex(i);
  }, [pages.length]);

  // check every uploaded PDF that hasn't been checked yet (e.g. after loading a sample)
  useEffect(() => {
    if (!state.application || !type) return;
    for (const p of pages) {
      const f = files[p.documentType];
      if (!f || reviews[p.documentType] || running.current.has(p.documentType)) continue;
      running.current.add(p.documentType);
      setReview(p.documentType, { status: "checking" });
      void checkPage(p.documentType, f, state.application, facts).then((r) => {
        running.current.delete(p.documentType);
        setReview(p.documentType, r);
      });
    }
  });

  useEffect(() => {
    if (confirmOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirmOpen]);

  if (!hydrated) return null;
  if (!type || !state.application || !page) {
    return (<><h1>Requirements and uploads</h1><p>Complete the preview and application details first.</p><a className="btn" href="/project">Start</a></>);
  }

  const project = PROJECT_OPTIONS.find((o) => o.type === type)!;
  const file = files[page.documentType];
  const review = reviews[page.documentType];
  const checks = pageChecks(page, review, state.application, !!file);
  const problems = fileFindings(review);
  const complete = pageComplete(checks, review, !!file);
  const links = [...new Map(page.items.flatMap((i) => i.links).map((l) => [l.url + l.label, l])).values()];
  const statusOf = (d: DocumentType) => {
    const p = pages.find((x) => x.documentType === d)!;
    const r = reviews[d];
    if (!files[d]) return "none";
    return pageComplete(pageChecks(p, r, state.application!, true), r, true) ? "ok" : r?.status === "checking" ? "wait" : "no";
  };
  const doneCount = pages.filter((p) => statusOf(p.documentType) === "ok").length;

  async function add(list: FileList | null) {
    const f = list?.[0];
    if (!f) return;
    const up: UploadedFile = { name: f.name, type: f.type, bytes: new Uint8Array(await f.arrayBuffer()) };
    setFile(page!.documentType, up); // the effect above runs the automatic check
  }
  function go(to: number) {
    setShowWhere(null);
    if (to < 0) return router.push("/application");
    if (to >= pages.length) return router.push("/declaration");
    setIndex(to);
    window.scrollTo({ top: 0 });
  }
  function next() {
    if (complete) return go(index + 1);
    setConfirmOpen(() => () => go(index + 1));
  }

  return (
    <>
      <h1>Requirements and uploads</h1>
      <p className="lead">{project.label}: upload each document as a PDF. We check each one automatically.</p>

      <section className="req-page" aria-labelledby="page-title">
        <div className="req-left">
          <p className="muted" style={{ margin: 0, fontWeight: 700 }}>Document {index + 1} of {pages.length}</p>
          <h2 id="page-title" style={{ marginTop: 4 }}>{page.label}</h2>
          {page.items.map((item) => (
            <div className="req-item" key={item.requirementId}>
              <h3>{item.label}</h3>
              <p style={{ margin: "0 0 4px" }}>{item.plainLanguage}</p>
              <ul className="checks" aria-label={`What we check: ${item.label}`}>
                {checks.filter((c) => item.details.some((d) => d.id === c.id)).map((c) => {
                  const [cls, icon, text] = ICON[c.state];
                  const bad = c.state === "not_found" || c.state === "missing_from_application";
                  return (
                    <li key={c.id} data-check={c.id} data-state={c.state}>
                      <span className={`status-icon ${cls}`} aria-hidden>{icon}</span>
                      <span>
                        <span className="check-label">{c.label}</span> <span className="sr">{text}</span>
                        <span className={`check-note ${bad ? "bad" : ""}`}>
                          {c.state === "found" && c.evidence?.quote ? `Found: “${c.evidence.quote}”` : c.note ?? text}
                        </span>
                        {bad && <span className="check-note">{c.state === "missing_from_application" ? <>Fix it in <a href="/application">Application</a>.</> : `Where to add it: ${c.whereToAdd}`}</span>}
                        {bad && c.evidence && review?.status === "done" && (
                          <button type="button" className="linkish" style={{ fontSize: 15 }} onClick={() => setShowWhere(showWhere === c.id ? null : c.id)}>
                            {showWhere === c.id ? "Hide drawing" : "Show me where"}
                          </button>
                        )}
                        {showWhere === c.id && c.evidence && review?.status === "done" && (
                          <div style={{ marginTop: 8 }}><Viewer evidence={c.evidence} docs={review.result.documents} /></div>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="req-right">
          <h3>Upload {page.label.toLowerCase()} (PDF)</h3>
          <div className={`upload-box ${over ? "over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); void add(e.dataTransfer.files); }}>
            <p style={{ margin: "0 0 8px" }}>Drag one PDF here, or</p>
            <button type="button" className="btn small secondary" onClick={() => input.current?.click()}>{file ? "Replace file" : "Choose file"}</button>
            <input ref={input} type="file" accept=".pdf,application/pdf,.png,.jpg,.jpeg,.docx" className="sr"
              aria-label={`Upload ${page.label}`} onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
          </div>
          {file && (
            <div className="file-card">
              <span>{file.name} <span className="muted">({Math.max(1, Math.ceil(file.bytes.byteLength / 1024))} KB)</span></span>
              <button type="button" className="btn small secondary" onClick={() => setFile(page.documentType, null)} aria-label={`Remove ${file.name}`}>Remove</button>
            </div>
          )}
          <div role="status" aria-live="polite">
            {file && review?.status === "checking" && <p className="check-state">Checking your file…</p>}
            {file && review?.status === "done" && (complete
              ? <p className="check-state ok">✓ Everything on this page was found.</p>
              : <p className="check-state bad">Some items need attention.</p>)}
            {file && review?.status === "error" && <p className="check-state bad">We couldn&apos;t check this file automatically right now. You can continue; it will be listed as unchecked.</p>}
          </div>
          {problems.length > 0 && (
            <ul style={{ paddingLeft: 18, marginBottom: 0 }} aria-label="Problems with this file">
              {problems.map((p) => <li key={p.id} className="check-note bad" style={{ fontWeight: 700 }}>{p.message}{p.conflictsWith?.[0]?.value !== undefined && ` (file: ${p.evidence[0]?.value}; application: ${p.conflictsWith[0].value})`}</li>)}
            </ul>
          )}
          {links.length > 0 && (
            <>
              <h3 style={{ marginTop: 20 }}>Where to find guidance</h3>
              <ul style={{ paddingLeft: 18, margin: 0, fontSize: 15 }}>
                {links.map((l) => <li key={l.url + l.label}><ExtLink href={l.url}>{l.label}</ExtLink></li>)}
              </ul>
            </>
          )}
        </div>
      </section>

      <div className="item-nav">
        <button type="button" className="btn secondary" onClick={() => go(index - 1)}>Previous</button>
        <button type="button" className="btn" onClick={next} disabled={review?.status === "checking"}>
          {index === pages.length - 1 ? "Next: Declaration" : "Next"}
        </button>
      </div>

      <div className="progress" aria-label="Progress">
        <strong>{doneCount} of {pages.length} documents complete</strong>
        <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={pages.length} aria-valuenow={doneCount} aria-label="Documents complete">
          <span style={{ width: `${(doneCount / pages.length) * 100}%` }} />
        </div>
        <ol>
          {pages.map((p, i) => {
            const st = statusOf(p.documentType);
            return (
              <li key={p.documentType}>
                <button type="button" aria-current={i === index ? "step" : undefined} onClick={() => go(i)}>
                  <span className={`dot ${st === "ok" ? "ok" : st === "no" ? "no" : ""}`} aria-hidden />
                  {i + 1}. {p.label}
                  <span className="sr">{st === "ok" ? " (complete)" : st === "none" ? " (not uploaded)" : st === "wait" ? " (checking)" : " (needs attention)"}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <dialog ref={dialog} className="confirm" aria-labelledby="confirm-title" onClose={() => setConfirmOpen(null)}>
        <h2 id="confirm-title">{file ? "Some items on this page weren't found" : `No ${page.label.toLowerCase()} uploaded`}</h2>
        <p>{file ? "Not everything we check on this document was found." : "This document is required."} Do you want to continue anyway? It will be listed as unfinished in your summary.</p>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn secondary" onClick={() => setConfirmOpen(null)}>Stay on this page</button>
          <button type="button" className="btn" onClick={() => { const f = confirmOpen; setConfirmOpen(null); f?.(); }}>Continue anyway</button>
        </div>
      </dialog>
    </>
  );
}

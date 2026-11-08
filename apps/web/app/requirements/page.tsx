"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { documentPages, pageGroups, PROJECT_OPTIONS } from "@permit/engine";
import type { DocumentType } from "@permit/schema";
import { useStore, useVisit } from "../../lib/store";
import { currentReview, factsFor, fileFindings, pageChecks, pageComplete, PLACEHOLDER_TICKS, problemText, type DetailCheck } from "../../lib/review";
import { ExtLink } from "../../components/ExtLink";

const ICON: Record<DetailCheck["state"], [string, string, string]> = {
  found: ["ok", "✓", PLACEHOLDER_TICKS ? "PDF uploaded" : "Found on your PDF"],
  not_found: ["no", "✗", "Not found on your PDF"],
  checking: ["wait", "…", "Checking…"],
  pending: ["wait", "–", "Upload the PDF to check"],
};

export default function RequirementsPage() {
  useVisit("/requirements");
  const router = useRouter();
  const { state, hydrated, files, upload, remove, reviews } = useStore();
  const [index, setIndex] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState<null | (() => void)>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

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
  const review = currentReview(file, reviews[page.documentType]);
  const checks = pageChecks(page, review, !!file);
  const problems = fileFindings(review);
  const complete = pageComplete(checks, review, !!file);
  // Before upload (or while checking) every field is listed. Once the PDF's result is in, only the unfinished
  // fields stay open; completed ones (and blank "if applicable" ones) fold into one collapsed list.
  const { intro, groups } = pageGroups(page);
  const byId = new Map(checks.map((c) => [c.id, c]));
  const settled = !!file && checks.every((c) => c.state === "found" || c.state === "not_found");
  const unfinished = (c: DetailCheck) => !settled || (c.state === "not_found" && !c.optional);
  const openCount = checks.filter(unfinished).length;
  const doneCount = checks.length - openCount;
  const links = [...new Map(page.items.flatMap((i) => i.links).map((l) => [l.url + l.label, l])).values()];
  const statusOf = (d: DocumentType) => {
    const p = pages.find((x) => x.documentType === d)!;
    const r = currentReview(files[d], reviews[d]);
    if (!files[d]) return "none";
    return pageComplete(pageChecks(p, r, true), r, true) ? "ok" : !r || r.status === "checking" ? "wait" : "no";
  };
  const pagesDone = pages.filter((p) => statusOf(p.documentType) === "ok").length;

  function renderCheck(c: DetailCheck) {
    const [cls, icon, text] = ICON[c.state];
    const bad = c.state === "not_found" && !c.optional;
    const note = c.state === "found" && c.evidence?.quote ? `Found: “${c.evidence.quote}”`
      : c.state === "not_found" && c.optional ? "Not on your PDF. Fill it in only if it applies." : text;
    return (
      <li key={c.id} data-check={c.id} data-state={c.state}>
        <span className={`status-icon ${c.state === "not_found" && c.optional ? "wait" : cls}`} aria-hidden>{icon}</span>
        <span>
          <span className="check-label">{c.label}</span>{c.optional && <span className="muted"> (if applicable)</span>} <span className="sr">{text}</span>
          <span className={`check-note ${bad ? "bad" : ""}`}>{note}</span>
          {bad && <span className="check-note">Where to add it: {c.whereToAdd}</span>}
        </span>
      </li>
    );
  }
  /** The page's groups (form sections, or requirements), each with only the fields that pass `keep`. */
  function renderGroups(keep: (c: DetailCheck) => boolean, withIntro: boolean) {
    return groups.map((g) => {
      const cs = g.detailIds.flatMap((id) => { const c = byId.get(id); return c && keep(c) ? [c] : []; });
      if (!cs.length) return null;
      return (
        <div className="req-item" key={g.key}>
          <h3>{g.title}</h3>
          {withIntro && g.intro && <p style={{ margin: "0 0 4px" }}>{g.intro}</p>}
          <ul className="checks" aria-label={`What we check: ${g.title}`}>{cs.map(renderCheck)}</ul>
        </div>
      );
    });
  }

  async function add(list: FileList | null) {
    const f = list?.[0];
    if (!f) return;
    // saved on the server, then reviewed; the page shows "Checking…" until then
    await upload(page!.documentType, { name: f.name, type: f.type, bytes: new Uint8Array(await f.arrayBuffer()) });
  }
  function go(to: number) {
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
      <p className="lead">{project.label}: upload each document as a PDF. {PLACEHOLDER_TICKS
        ? "The items on a page are ticked once its PDF is uploaded."
        : "Each item is ticked automatically when we find it on the PDF you upload on that page."}</p>

      <section className="req-page" aria-labelledby="page-title">
        <div className="req-left">
          <p className="muted" style={{ margin: 0, fontWeight: 700 }}>Document {index + 1} of {pages.length}</p>
          <h2 id="page-title" style={{ marginTop: 4 }}>{page.label}</h2>
          {intro && <p style={{ margin: "0 0 4px" }}>{intro}</p>}
          {settled && (openCount
            ? <p className="check-summary bad">{openCount} {openCount === 1 ? "item needs" : "items need"} attention on this PDF.</p>
            : <p className="check-summary ok">✓ {PLACEHOLDER_TICKS ? `All ${checks.length} items on this page are ticked.` : `All ${checks.length} items were found on your PDF.`}</p>)}
          {renderGroups(unfinished, true)}
          {settled && doneCount > 0 && (
            <details className="done-list">
              <summary>Completed items ({doneCount})</summary>
              {renderGroups((c) => !unfinished(c), false)}
            </details>
          )}
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
              <span className="file-name">{file.name} <span className="muted">({Math.max(1, Math.ceil(file.size / 1024))} KB)</span></span>
              <button type="button" className="btn small secondary" onClick={() => void remove(page.documentType)} aria-label={`Remove ${file.name}`}>Remove</button>
            </div>
          )}
          <div role="status" aria-live="polite">
            {file && (!review || review.status === "checking") && <p className="check-state">Saving and checking the file…</p>}
            {file && review?.status === "done" && (complete
              ? <p className="check-state ok">✓ {PLACEHOLDER_TICKS ? "PDF uploaded. All items on this page are ticked." : "Everything on this page was found."}</p>
              : <p className="check-state bad">Some items need attention.</p>)}
            {file && review?.status === "error" && <p className="check-state bad">This file was not saved. Check that the review service is running, then upload it again.</p>}
          </div>
          {problems.length > 0 && (
            <ul style={{ paddingLeft: 18, marginBottom: 0 }} aria-label="Problems with this file">
              {problems.map((p) => <li key={p.id} className="check-note bad"><strong>{p.message}</strong>{problemText(p) && <> {problemText(p)}</>}</li>)}
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
        <button type="button" className="btn" onClick={next} disabled={!PLACEHOLDER_TICKS && !!file && (!review || review.status === "checking")}>
          {index === pages.length - 1 ? "Next: Declaration" : "Next"}
        </button>
      </div>

      <div className="progress" aria-label="Progress">
        <strong>{pagesDone} of {pages.length} documents complete</strong>
        <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={pages.length} aria-valuenow={pagesDone} aria-label="Documents complete">
          <span style={{ width: `${(pagesDone / pages.length) * 100}%` }} />
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

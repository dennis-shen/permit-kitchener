"use client";
import { useEffect, useMemo, useState } from "react";
import { ITEM_STATUS_LABELS, type FindingCategory } from "@permit/schema";
import { useStore } from "../../lib/store";
import { buildReport } from "../../lib/merge";
import { FindingCard } from "../../components/FindingCard";
import { ReadinessBanner } from "../../components/ReadinessBanner";

const ORDER: [FindingCategory, string][] = [
  ["missing", "Missing"], ["incomplete", "Incomplete"], ["inconsistent", "Inconsistent"], ["wrong", "Wrong file or format"], ["unclear", "Unclear"],
];

export default function ResultsPage() {
  const { state, set } = useStore();
  const [plain, setPlain] = useState<Record<string, string>>({});
  const review = state.review;
  const { report } = useMemo(() => (review ? buildReport({ ...review, overrides: [] }) : { report: state.report }), [review, state.report]);
  const live = useMemo(() => (review ? buildReport(review).report : state.report), [review, state.report]);

  useEffect(() => { document.getElementById("readiness")?.focus(); }, []);
  useEffect(() => {
    if (!report || report.findings.length === 0) return;
    fetch("/api/explain", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(report) })
      .then((r) => (r.ok ? r.json() : {})).then(setPlain).catch(() => {});
  }, [report]);

  if (!report || !live || !review) {
    return (<><h1>Results</h1><p>Run a document check first.</p><a className="btn" href="/check">Check my documents</a></>);
  }
  const docs = review.vision?.documents ?? [];
  const overrides = new Set(review.overrides);
  const toggle = (ids: string[], on: boolean) => {
    const next = on ? [...new Set([...review.overrides, ...ids])] : review.overrides.filter((x) => !ids.includes(x));
    const r = { ...review, overrides: next };
    set({ review: r, report: buildReport(r).report });
  };
  const counts = ORDER.map(([c, l]) => [c, l, new Set(report.findings.filter((f) => f.category === c).map((f) => f.message)).size] as const).filter(([, , n]) => n > 0);

  return (
    <>
      <h1>Results</h1>
      <p className="lead">{review.application.property_address || "Your project"} · {review.application.application_id}</p>
      <ReadinessBanner report={live} />
      {review.vision === null && review.manualDocs.length > 0 && (
        <p className="muted">Based on what you ticked. Upload your files for an automatic check of the drawings.</p>
      )}
      {review.vision && (
        <p className="muted">Read {docs.length} file{docs.length === 1 ? "" : "s"}{review.vision.vlm_used ? " with AI-assisted reading" : ""}.
          {Object.keys(review.vision.inferred_attributes).length > 0 && " We also picked up facts from your drawings (for example, a wall being removed)."}</p>
      )}

      {counts.length > 0 && (
        <div className="counts">{counts.map(([c, l, n]) => <span key={c} className={`chip ${c}`}>{n} {l.toLowerCase()}</span>)}</div>
      )}

      {ORDER.map(([cat, label]) => {
        // Findings that share a message (e.g. rear and side property lines) are shown as one card.
        const groups = new Map<string, typeof report.findings>();
        for (const f of report.findings.filter((x) => x.category === cat)) groups.set(f.message, [...(groups.get(f.message) ?? []), f]);
        const list = [...groups.values()];
        if (!list.length) return null;
        return (
          <section key={cat} aria-labelledby={`sec-${cat}`}>
            <h2 id={`sec-${cat}`}>{label}</h2>
            <div className="grid">
              {list.map((g) => (
                <FindingCard key={g[0]!.id} f={g[0]!} docs={docs} plain={plain[g[0]!.id]}
                  overridden={g.every((f) => overrides.has(f.id))} onOverride={(on) => toggle(g.map((f) => f.id), on)} />
              ))}
            </div>
          </section>
        );
      })}

      <h2>All requirements</h2>
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="items">
          <thead><tr><th>Requirement</th><th>Status</th><th>Notes</th></tr></thead>
          <tbody>
            {live.items.map((it) => (
              <tr key={it.requirementId}>
                <td>{it.label}</td>
                <td><span className={`chip ${it.status}`}>{ITEM_STATUS_LABELS[it.status]}</span></td>
                <td>{it.issues.map((i) => i.message).filter((m, j, a) => a.indexOf(m) === j).join(" ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {docs.length > 0 && (
        <>
          <h2>What we read in each file</h2>
          <div className="grid two">
            {docs.map((d) => (
              <div className="card" key={d.filename}>
                <h3 style={{ overflowWrap: "anywhere" }}>{d.filename}</h3>
                <p className="muted" style={{ margin: 0, fontSize: 14 }}>Looks like: {d.document_type.replace(/_/g, " ")} · {d.pages} page{d.pages === 1 ? "" : "s"} · {Math.round(d.confidence * 100)}% read confidence</p>
                <p style={{ margin: "6px 0 0", fontSize: 14 }}>{d.shown_details.length} required details found</p>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="row noprint" style={{ marginTop: 20 }}>
        <a className="btn" href="/summary">View printable summary</a>
        <a className="btn secondary" href="/check">Upload revised files</a>
      </p>
    </>
  );
}

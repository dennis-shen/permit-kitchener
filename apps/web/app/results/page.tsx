"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { permitExplanation } from "@permit/engine";
import { ITEM_STATUS_LABELS, type FindingCategory } from "@permit/schema";
import { useStore } from "../../lib/store";
import { buildReport } from "../../lib/merge";
import { FindingCard } from "../../components/FindingCard";
import { ReadinessBanner } from "../../components/ReadinessBanner";
import { StepFooter } from "../../components/StepFooter";

const ORDER: [FindingCategory, string][] = [
  ["missing", "Missing"], ["incomplete", "Incomplete"], ["inconsistent", "Inconsistent"], ["wrong", "Wrong file or format"], ["unclear", "Unclear"],
];

export default function ResultsPage() {
  const router = useRouter();
  const { state, set, hydrated } = useStore();
  const [plain, setPlain] = useState<Record<string, string>>({});
  const review = state.review;
  const notRequired = review?.permitRequired === false;
  // all findings (to show, including ones the user ticked off) and the live report (overrides applied)
  const all = useMemo(() => (review && !notRequired ? buildReport({ ...review, overrides: [] }).report : null), [review, notRequired]);
  const live = useMemo(() => (review && !notRequired ? buildReport(review).report : null), [review, notRequired]);

  useEffect(() => { document.getElementById("readiness")?.focus(); }, [hydrated]);
  useEffect(() => {
    if (!all || all.findings.length === 0) return;
    fetch("/api/explain", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(all) })
      .then((r) => (r.ok ? r.json() : {})).then(setPlain).catch(() => {});
  }, [all]);

  if (!hydrated) return null;
  if (!review) {
    return (<><h1>Results</h1><p>Complete the requirements step first.</p><a className="btn" href="/requirements">Go to requirements</a></>);
  }

  if (notRequired) {
    return (
      <>
        <h1>Results</h1>
        <p className="lead">{review.application.property_address}</p>
        <div className="banner ok" role="status" tabIndex={-1} id="readiness">
          <span className="icon" aria-hidden>✓</span>
          <div>
            <strong>A permit may not be required</strong>
            <p>{permitExplanation(review.application.project_type)} No documents were requested.</p>
            <p style={{ fontSize: 15 }}>This is preliminary guidance only. Confirm with the City of Kitchener before you start work.</p>
          </div>
        </div>
        <StepFooter back="/requirements" onContinue={() => router.push("/summary")} continueLabel="Continue to summary" />
      </>
    );
  }

  const report = all!;
  const docs = review.vision?.documents ?? [];
  const overrides = new Set(review.overrides);
  const toggle = (ids: string[], on: boolean) => {
    const next = on ? [...new Set([...review.overrides, ...ids])] : review.overrides.filter((x) => !ids.includes(x));
    set({ review: { ...review, overrides: next } });
  };
  const counts = ORDER.map(([c, l]) => [c, l, new Set(report.findings.filter((f) => f.category === c).map((f) => f.message)).size] as const).filter(([, , n]) => n > 0);

  return (
    <>
      <h1>Results</h1>
      <p className="lead">{review.application.property_address || "Your project"}</p>
      <ReadinessBanner report={live!} />
      {review.vision === null && <p className="muted">Based on what you ticked in the checklist{review.manualDocs.length ? "" : " (no files uploaded)"}.</p>}
      {review.vision && (
        <p className="muted">We read {docs.length} file{docs.length === 1 ? "" : "s"}{review.vision.vlm_used ? " with AI-assisted reading" : ""}.
          {Object.keys(review.vision.inferred_attributes).length > 0 && " We also picked up facts from your drawings, such as a wall being removed."}</p>
      )}
      {counts.length > 0 && <div className="counts">{counts.map(([c, l, n]) => <span key={c} className={`chip ${c}`}>{n} {l.toLowerCase()}</span>)}</div>}

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
            {live!.items.map((it) => (
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
          <div className="grid three">
            {docs.map((d) => (
              <div className="card" key={d.filename}>
                <h3 style={{ overflowWrap: "anywhere" }}>{d.filename}</h3>
                <p className="muted" style={{ margin: 0, fontSize: 15 }}>Read as: {d.document_type.replace(/_/g, " ")} · {d.pages} page{d.pages === 1 ? "" : "s"} · {Math.round(d.confidence * 100)}% read confidence</p>
                <p style={{ margin: "6px 0 0", fontSize: 15 }}>{d.shown_details.length} required details found</p>
              </div>
            ))}
          </div>
        </>
      )}
      <StepFooter back="/requirements" onContinue={() => router.push("/summary")} continueLabel="Continue to summary" />
    </>
  );
}

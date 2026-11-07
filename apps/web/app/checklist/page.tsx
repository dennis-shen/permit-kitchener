"use client";
import { buildChecklist, answersToFacts, TYPE_LABELS } from "@permit/engine";
import { useStore } from "../../lib/store";
import { DOC_LABELS } from "../../lib/labels";


export default function ChecklistPage() {
  const { state } = useStore();
  const type = state.classification?.projectType ?? state.review?.application.project_type;
  if (!type) {
    return (
      <>
        <h1>Your checklist</h1>
        <p>Answer the project questions first so we know which requirements apply.</p>
        <a className="btn" href="/classify">Start</a>
      </>
    );
  }
  const facts = { ...answersToFacts(state.answers), ...(state.review?.attributes ?? {}) };
  const items = buildChecklist(type, facts);
  return (
    <>
      <h1>Checklist: {TYPE_LABELS[type]}</h1>
      <p className="lead">Prepare these items before you apply. Each one links to the official City page with current requirements.</p>
      <div className="grid">
        {items.map((it) => (
          <section className="card" key={it.requirementId} aria-labelledby={`h-${it.requirementId}`}>
            <h3 id={`h-${it.requirementId}`}>☐ {it.label}</h3>
            <p className="muted" style={{ margin: "2px 0 8px", fontSize: 14 }}>
              Goes on: {DOC_LABELS[it.documentType] ?? it.documentType} · InfoPkg {it.infoPkgSection}
            </p>
            <p style={{ margin: "0 0 8px" }}>{it.plainLanguage}</p>
            {it.details.length > 0 && (
              <ul style={{ margin: "0 0 8px" }}>{it.details.map((d) => <li key={d.id}>{d.label}</li>)}</ul>
            )}
            {it.resources.map((r) => (
              <a key={r.id} href={r.url} target="_blank" rel="noreferrer" style={{ fontSize: 14, marginRight: 12 }}>{r.title} ↗</a>
            ))}
          </section>
        ))}
      </div>
      <p className="row noprint" style={{ marginTop: 16 }}>
        <a className="btn" href="/check">Check my documents</a>
        <button className="btn secondary" onClick={() => window.print()}>Print checklist</button>
      </p>
    </>
  );
}

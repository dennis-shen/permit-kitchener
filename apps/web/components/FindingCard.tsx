"use client";
import { useState } from "react";
import type { Finding, ReviewedDocument } from "@permit/schema";
import { Viewer } from "./Viewer";

const ICON: Record<string, string> = { missing: "✖", incomplete: "◐", unclear: "?", inconsistent: "≠", wrong: "⚠" };

export function FindingCard({ f, docs, plain, overridden, onOverride }: {
  f: Finding; docs: ReviewedDocument[]; plain?: string; overridden: boolean; onOverride: (on: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const canShow = f.evidence.length > 0 && docs.some((d) => d.filename === f.evidence[0]!.filename && d.previews.length > 0);
  return (
    <article className={`card finding ${f.category} ${overridden ? "overridden" : ""}`}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className={`chip ${f.category}`}><span aria-hidden>{ICON[f.category]}</span> {f.category}</span>
        {f.staffGuidance && <span className="chip unclear">Staff guidance recommended</span>}
      </div>
      <h3 style={{ marginTop: 8 }}>{f.message}</h3>
      {plain && plain !== f.message && plain !== f.reference?.howToFix && <p style={{ margin: "4px 0" }}>{plain}</p>}

      {f.conflictsWith && (
        <div className="side" style={{ marginTop: 10 }}>
          <div className="card"><div className="muted">On {f.evidence[0]?.filename}</div><div className="value">{String(f.evidence[0]?.value ?? f.evidence[0]?.quote ?? "")}</div></div>
          <div className="card"><div className="muted">On {f.conflictsWith[0]?.filename}</div><div className="value">{String(f.conflictsWith[0]?.value ?? "")}</div></div>
        </div>
      )}

      {f.reference && (
        <dl className="ref">
          <dt>Requirement</dt><dd>{f.reference.requirementLabel}</dd>
          {f.reference.whereToAdd && <><dt>Where to add it</dt><dd>{f.reference.whereToAdd}</dd></>}
          <dt>Where to find guidance</dt>
          <dd>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {(f.reference.links?.length ? f.reference.links : [{ label: "Official City of Kitchener guidance", url: f.reference.cityUrl }]).map((l) => (
                <li key={l.url + l.label}><a href={l.url} target="_blank" rel="noreferrer">{l.label}</a></li>
              ))}
            </ul>
          </dd>
        </dl>
      )}

      <div className="row noprint" style={{ marginTop: 10 }}>
        {canShow && <button className="btn small secondary" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Hide drawing" : "Show me where"}</button>}
        <label className="row" style={{ fontSize: 14, gap: 6 }}>
          <input type="checkbox" checked={overridden} onChange={(e) => onOverride(e.target.checked)} />
          I&apos;ve dealt with this / it&apos;s already included
        </label>
      </div>
      {open && canShow && <div style={{ marginTop: 10 }}>{f.evidence.map((e, i) => <Viewer key={i} evidence={e} docs={docs} />)}</div>}
    </article>
  );
}

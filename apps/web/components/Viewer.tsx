"use client";
import type { Evidence, ReviewedDocument } from "@permit/schema";

/** Shows a page render with the evidence box highlighted (dashed = where the item is expected). */
export function Viewer({ evidence, docs }: { evidence: Evidence; docs: ReviewedDocument[] }) {
  const doc = docs.find((d) => d.filename === evidence.filename);
  const page = doc?.previews.find((p) => p.page === evidence.page) ?? doc?.previews[0];
  if (!page) {
    return <p className="muted">{evidence.filename}{evidence.quote ? ` — “${evidence.quote}”` : ""}</p>;
  }
  const b = evidence.bbox;
  const style = b
    ? { left: `${(b[0] / page.width) * 100}%`, top: `${(b[1] / page.height) * 100}%`,
        width: `${((b[2] - b[0]) / page.width) * 100}%`, height: `${((b[3] - b[1]) / page.height) * 100}%` }
    : undefined;
  return (
    <figure style={{ margin: 0 }}>
      <div className="viewer">
        <img src={`data:image/png;base64,${page.png_base64}`} alt={`${evidence.filename}, page ${page.page}`} />
        {style && <div className={`box ${evidence.expectedRegion ? "expected" : ""}`} style={style} aria-hidden />}
      </div>
      <figcaption className="muted" style={{ fontSize: 13, marginTop: 4 }}>
        {evidence.filename}, page {page.page}
        {evidence.quote ? <> — found: “{evidence.quote}”</> : null}
        {!b ? " — add the item to this drawing" : evidence.expectedRegion ? " — expected here" : ""}
        {` · ${evidence.source}`}{evidence.confidence < 1 ? ` · ${Math.round(evidence.confidence * 100)}% confidence` : ""}
      </figcaption>
    </figure>
  );
}

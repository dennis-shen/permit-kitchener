"use client";
import { TYPE_LABELS } from "@permit/engine";
import { useStore } from "../../lib/store";
import { buildReport } from "../../lib/merge";
import { ReadinessBanner } from "../../components/ReadinessBanner";

export default function SummaryPage() {
  const { state } = useStore();
  const review = state.review;
  if (!review) return (<><h1>Summary</h1><p>Run a document check first.</p><a className="btn" href="/check">Check my documents</a></>);
  const report = buildReport(review).report;
  const outstanding = report.findings
    .filter((f) => !review.overrides.includes(f.id))
    .filter((f, i, all) => all.findIndex((g) => g.message === f.message) === i);
  const a = review.application;

  function download() {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const el = Object.assign(document.createElement("a"), { href: url, download: `${a.application_id}-readiness.json` });
    el.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <h1>Application summary</h1>
      <div className="card" style={{ marginBottom: 16 }}>
        <dl className="ref" style={{ background: "transparent", padding: 0, margin: 0 }}>
          <dt>Applicant</dt><dd>{a.applicant_organisation ? `${a.applicant_organisation} (${a.applicant_name})` : a.applicant_name || "—"}</dd>
          <dt>Property</dt><dd>{a.property_address || "—"}</dd>
          <dt>Project</dt><dd>{TYPE_LABELS[a.project_type]} — {a.project_description || "no description"}</dd>
          <dt>Estimated value</dt><dd>${a.estimated_construction_value.toLocaleString()}</dd>
          <dt>Permit</dt><dd>{report.permit_required === true ? "Likely required" : report.permit_required === false ? "May not be required — confirm with the City" : "Unknown"}</dd>
        </dl>
      </div>
      <ReadinessBanner report={report} />
      <h2>Outstanding items ({outstanding.length})</h2>
      {outstanding.length === 0 ? <p>None identified.</p> : (
        <ol>
          {outstanding.map((f) => (
            <li key={f.id} style={{ marginBottom: 8 }}>
              <strong>{f.message}</strong>
              {f.evidence[0] && <span className="muted"> — {f.evidence[0].filename}</span>}
              {f.reference && <> · <a href={f.reference.cityUrl}>City guidance</a></>}
            </li>
          ))}
        </ol>
      )}
      <h2>Next steps</h2>
      <ol>
        <li>Update your drawings and forms for each outstanding item.</li>
        <li>Run the check again with the revised files.</li>
        <li>Apply through the City&apos;s <a href="https://www.kitchener.ca/development-and-construction/building-permits/apply-for-a-building-permit/">online application process</a>. City staff make the final decision.</li>
      </ol>
      <p className="row noprint" style={{ marginTop: 16 }}>
        <button className="btn" onClick={() => window.print()}>Print or save as PDF</button>
        <button className="btn secondary" onClick={download}>Download JSON</button>
      </p>
    </>
  );
}

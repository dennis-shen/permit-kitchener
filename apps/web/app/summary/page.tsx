"use client";
import { useState } from "react";
import { DETAIL_INDEX, PROJECT_OPTIONS, permitExplanation, REQUIREMENT_INDEX } from "@permit/engine";
import { READINESS_LABELS } from "@permit/schema";
import { useStore } from "../../lib/store";
import { buildReport } from "../../lib/merge";
import { buildSummaryPdf, downloadPdf, type OutstandingItem } from "../../lib/pdf";
import { ReadinessBanner } from "../../components/ReadinessBanner";
import { StepFooter } from "../../components/StepFooter";

const RESULT_TEXT: Record<string, string> = {
  appears_ready: "No missing items were identified using the simplified requirements.",
  action_required: "One or more required items are incomplete or missing. Each one is listed below with where to add it.",
  more_info_required: "The project could not be classified from the information provided.",
  staff_guidance_recommended: "Part of this project is not covered by the simplified requirements. Contact City staff for guidance.",
};

export default function SummaryPage() {
  const { state, hydrated, reset } = useStore();
  const [busy, setBusy] = useState(false);
  if (!hydrated) return null;
  const review = state.review;
  if (!review) return (<><h1>Summary</h1><p>Complete the earlier steps first.</p><a className="btn" href="/project">Start</a></>);
  const a = review.application;
  const projectLabel = PROJECT_OPTIONS.find((o) => o.type === a.project_type)?.label ?? a.project_type;
  const notRequired = review.permitRequired === false;
  const report = notRequired ? null : buildReport(review).report;

  // One row per message; findings that share a message (rear + side property lines) combine their "where to add it".
  const active = (report?.findings ?? []).filter((f) => !review.overrides.includes(f.id));
  const outstanding: OutstandingItem[] = [...new Set(active.map((f) => f.message))].map((message) => {
    const group = active.filter((f) => f.message === message);
    const f = group[0]!;
    const req = f.requirementId ? REQUIREMENT_INDEX[f.requirementId] : undefined;
    const where = [...new Set(group.map((g) => g.reference?.whereToAdd ?? (g.detailId ? DETAIL_INDEX[g.detailId]?.whereToAdd : undefined) ?? g.reference?.howToFix ?? ""))]
      .filter(Boolean).join(" ");
    const link = f.reference?.links?.[0] ?? (f.reference ? { label: "City of Kitchener building permits", url: f.reference.cityUrl } : undefined);
    return {
      requirement: req?.label ?? f.reference?.requirementLabel ?? "Uploaded files",
      message,
      whereToAdd: where,
      reference: link ? { label: link.label, url: link.url } : undefined,
      file: f.evidence[0] && !f.evidence[0].filename.endsWith("(declared)") ? f.evidence[0].filename : undefined,
    };
  });
  const complete = (report?.items ?? []).filter((i) => i.status === "complete").map((i) => i.label);
  const permitLine = notRequired
    ? `A permit may not be required. ${permitExplanation(a.project_type) ?? ""} Confirm with the City.`
    : report?.permit_required === true ? "A building permit is likely required for this project."
    : "We could not tell whether a permit is required. Confirm with the City.";
  const resultLabel = notRequired ? "A permit may not be required" : READINESS_LABELS[report!.readiness];
  const resultText = notRequired ? "No documents were requested." : RESULT_TEXT[report!.readiness]!;

  async function download() {
    setBusy(true);
    const bytes = await buildSummaryPdf({
      application: a, report, projectLabel, permitLine, resultLabel, resultText, outstanding, complete,
      generatedOn: new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" }),
    });
    downloadPdf(bytes, `${a.application_id}-permit-application-summary.pdf`);
    setBusy(false);
  }

  return (
    <>
      <h1>Application summary</h1>
      <p className="lead">Download a PDF with your application details and everything that still needs attention.</p>
      <div className="card" style={{ marginBottom: 18 }}>
        <dl className="kv">
          <dt>Applicant</dt><dd>{a.applicant_organisation ? `${a.applicant_organisation} (${a.applicant_name})` : a.applicant_name || "—"}</dd>
          <dt>Property</dt><dd>{a.property_address || "—"}</dd>
          <dt>Project</dt><dd>{projectLabel}</dd>
          <dt>Description</dt><dd>{a.project_description || "—"}</dd>
          <dt>Estimated value</dt><dd>${a.estimated_construction_value.toLocaleString("en-CA")}</dd>
          <dt>Permit</dt><dd>{permitLine}</dd>
        </dl>
      </div>
      {report ? <ReadinessBanner report={buildReport(review).report} /> : (
        <div className="banner ok" role="status"><span className="icon" aria-hidden>✓</span><div><strong>{resultLabel}</strong><p>{permitLine}</p></div></div>
      )}
      <h2>Missing or incomplete items ({outstanding.length})</h2>
      {outstanding.length === 0 ? <p>None identified.</p> : (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="items">
            <thead><tr><th>#</th><th>Requirement</th><th>What is missing</th><th>Where to add it</th></tr></thead>
            <tbody>
              {outstanding.map((o, i) => (
                <tr key={o.message}><td>{i + 1}</td><td><strong>{o.requirement}</strong></td><td>{o.message}</td><td>{o.whereToAdd}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <StepFooter back="/results"
        extra={<button className="linkish" onClick={() => { reset(); window.location.href = "/"; }}>Start a new application</button>}
        onContinue={download} continueLabel="Download PDF summary" busy={busy} />
    </>
  );
}

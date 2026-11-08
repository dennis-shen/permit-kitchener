"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { documentPages, PROJECT_OPTIONS } from "@permit/engine";
import { DISCLAIMER, type DocumentType } from "@permit/schema";
import { useStore, useVisit } from "../../lib/store";
import { buildReport, factsFor, pageOf, whereToAddFor } from "../../lib/review";
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
  useVisit("/summary");
  const router = useRouter();
  const { state, hydrated, files, reviews } = useStore();
  const [busy, setBusy] = useState(false);
  const [remind, setRemind] = useState(false);
  const reminder = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (remind) reminder.current?.showModal(); else reminder.current?.close(); }, [remind]);

  if (!hydrated) return null;
  const type = state.projectType;
  const a = state.application;
  if (!type || !a) return (<><h1>Summary</h1><p>Complete the earlier steps first.</p><a className="btn" href="/project">Start</a></>);
  const report = buildReport({ type, application: a, answers: state.answers, declaration: state.declaration, files, reviews });
  const projectLabel = PROJECT_OPTIONS.find((o) => o.type === type)?.label ?? type;
  const pages = documentPages(type, factsFor(type, state.answers));
  const pageLabel = (d?: DocumentType) => pages.find((p) => p.documentType === d)?.label ?? "Other";

  // One entry per message; findings sharing a message (rear + side property lines) are combined.
  const messages = [...new Set(report.findings.map((f) => f.message))];
  const groups = messages.map((message) => {
    const fs = report.findings.filter((f) => f.message === message);
    return { message, page: pageOf(fs[0]!, files), where: [...new Set(fs.map(whereToAddFor))].join(" "), first: fs[0]! };
  });
  const byPage = pages.map((p) => ({ page: p, items: groups.filter((g) => g.page === p.documentType) })).filter((x) => x.items.length);
  const other = groups.filter((g) => !g.page || !pages.some((p) => p.documentType === g.page));
  const complete = report.items.filter((i) => i.status === "complete").map((i) => i.label);
  const permitLine = report.permit_required === true ? "A building permit is likely required for this project."
    : report.permit_required === false ? "A permit may not be required. Confirm with the City."
    : "We could not tell whether a permit is required. Confirm with the City.";

  async function download() {
    setBusy(true);
    const outstanding: OutstandingItem[] = groups.map((g) => {
      const link = g.first.reference?.links?.[0] ?? (g.first.reference ? { label: "City of Kitchener building permits", url: g.first.reference.cityUrl } : undefined);
      return {
        requirement: pageLabel(g.page),
        message: g.message,
        whereToAdd: g.where,
        reference: link ? { label: link.label, url: link.url } : undefined,
        file: g.page ? files[g.page]?.name : undefined,
      };
    });
    const bytes = await buildSummaryPdf({
      application: a!, report, projectLabel, permitLine, resultLabel: report.readiness_label, resultText: RESULT_TEXT[report.readiness]!,
      outstanding, complete, generatedOn: new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" }),
    });
    downloadPdf(bytes, `${a!.application_id}-permit-application-summary.pdf`);
    setBusy(false);
  }

  const item = (g: (typeof groups)[number]) => (
    <li key={g.message}>
      <a href={g.page ? `/requirements?page=${g.page}` : "/requirements"} data-message={g.message}>
        <span className="msg">{g.message}</span>
        <span className="where">Where to add it: {g.where}</span>
        <span className="go">Go to {pageLabel(g.page).toLowerCase()} →</span>
      </a>
    </li>
  );

  return (
    <>
      <h1>Summary</h1>
      <p className="lead">Review your application. Select any unfinished item to go to the page where you can fix it.</p>
      <div className="card" style={{ marginBottom: 18 }}>
        <dl className="kv">
          <dt>Applicant</dt><dd>{a.applicant_organisation ? `${a.applicant_organisation} (${a.applicant_name})` : a.applicant_name || "—"}</dd>
          <dt>Property</dt><dd>{a.property_address || "—"}</dd>
          <dt>Project</dt><dd>{projectLabel}</dd>
          <dt>Description</dt><dd>{a.project_description || "—"}</dd>
          <dt>Estimated value</dt><dd>${a.estimated_construction_value.toLocaleString("en-CA")}</dd>
          <dt>Permit</dt><dd>{permitLine}</dd>
          <dt>Documents uploaded</dt><dd>{pages.filter((p) => files[p.documentType]).length} of {pages.length}</dd>
        </dl>
      </div>
      <ReadinessBanner report={report} />

      <h2>Unfinished items ({groups.length})</h2>
      {groups.length === 0 ? <p>None identified.</p> : (
        <>
          {byPage.map(({ page, items }) => (
            <div className="page-group" key={page.documentType}>
              <h3>{page.label}</h3>
              <ul className="unfinished">{items.map(item)}</ul>
            </div>
          ))}
          {other.length > 0 && (
            <div className="page-group"><h3>Files</h3><ul className="unfinished">{other.map(item)}</ul></div>
          )}
        </>
      )}

      {complete.length > 0 && (
        <>
          <h2>Requirements that appear complete</h2>
          <ul>{complete.map((c) => <li key={c}>{c}</li>)}</ul>
        </>
      )}

      <p style={{ marginTop: 24 }}>
        <button className="btn secondary" onClick={download} disabled={busy}>{busy ? "Preparing PDF…" : "Download PDF summary"}</button>
      </p>
      <StepFooter back="/declaration" onContinue={() => setRemind(true)} />
      <dialog ref={reminder} className="confirm" aria-labelledby="remind-title" onClose={() => setRemind(false)}>
        <h2 id="remind-title">Before you finish: this is preliminary guidance</h2>
        <p>{DISCLAIMER}</p>
        <p>This checker does not submit anything to the City. Submit your application through the City&apos;s own process.</p>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn secondary" onClick={() => setRemind(false)}>Go back</button>
          <button type="button" className="btn" onClick={() => { setRemind(false); router.push("/confirmation"); }}>I understand, continue</button>
        </div>
      </dialog>
    </>
  );
}


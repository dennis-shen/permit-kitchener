"use client";
import { DISCLAIMER } from "@permit/schema";
import { useStore, useVisit } from "../../lib/store";
import { buildReport } from "../../lib/review";
import { ExtLink } from "../../components/ExtLink";

export default function ConfirmationPage() {
  useVisit("/confirmation");
  const { state, hydrated, files, reviews, reset } = useStore();

  if (!hydrated) return null;
  const type = state.projectType;
  const a = state.application;
  if (!type || !a) return (<><h1>Confirmation</h1><p>Complete the earlier steps first.</p><a className="btn" href="/project">Start</a></>);
  const report = buildReport({ type, application: a, answers: state.answers, declaration: state.declaration, files, reviews });
  const unfinished = new Set(report.findings.map((f) => f.message)).size;
  const ready = report.readiness === "appears_ready";

  return (
    <>
      <h1>Confirmation</h1>
      <div className={`confirm-hero ${ready ? "ok" : "bad"}`} role="status" id="readiness">
        <div className="big">{ready ? "Application appears complete" : report.readiness_label}</div>
        {ready
          ? <p>Every required item we check was found. Your application appears ready to submit.</p>
          : report.readiness === "action_required"
            ? <p>{unfinished} item{unfinished === 1 ? " is" : "s are"} unfinished. <a href="/summary">Review the unfinished items</a>.</p>
            : <p>{report.readiness === "staff_guidance_recommended" ? "Part of this project needs guidance from City staff." : "More information is needed."} <a href="/summary">Review your summary</a>.</p>}
        <p className="muted" style={{ marginBottom: 0 }}>Reference {a.application_id} · {a.property_address}</p>
      </div>
      <h2>Next steps</h2>
      <ol>
        {!ready && <li>Fix each unfinished item, then come back to this page.</li>}
        <li>Download your PDF summary from the <a href="/summary">Summary</a> page and keep it with your application.</li>
        <li>Apply through the City&apos;s online services: <ExtLink href="https://www.kitchener.ca/development-and-construction/building-permits/apply-for-a-building-permit/">Apply for a building permit</ExtLink>. City staff review every application and make the final decision.</li>
      </ol>
      <p className="muted" style={{ fontSize: 15 }}>{DISCLAIMER}</p>
      <div className="step-footer">
        <a className="btn secondary" href="/summary">Back</a>
        <button className="btn secondary" onClick={async () => { await reset(); window.location.href = "/"; }}>Start a new application</button>
      </div>
    </>
  );
}

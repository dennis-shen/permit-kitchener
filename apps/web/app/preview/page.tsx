"use client";
import { useRouter } from "next/navigation";
import { allQuestionsAnswered, permitExplanation, permitRequired, PROJECT_OPTIONS, questionsFor, unusualFromAnswers } from "@permit/engine";
import { useStore, useVisit } from "../../lib/store";
import { factsFor } from "../../lib/review";
import { Questions } from "../../components/Questions";
import { StepFooter } from "../../components/StepFooter";
import { ExtLink } from "../../components/ExtLink";

const GUIDE: Record<string, { label: string; url: string }> = {
  solar_panels: { label: "Miscellaneous permits and applications (solar panels)", url: "https://www.kitchener.ca/development-and-construction/building-permits/miscellaneous-permits-and-applications/" },
  hvac_system: { label: "Residential building permits: Changing an HVAC system", url: "https://www.kitchener.ca/building-and-renovating/residential-building-permits/#hvacsystem" },
  default: { label: "Residential building permits", url: "https://www.kitchener.ca/building-and-renovating/residential-building-permits/" },
};

export default function PreviewPage() {
  useVisit("/preview");
  const router = useRouter();
  const { state, set, hydrated } = useStore();
  if (!hydrated) return null;
  const type = state.projectType;
  if (!type) return (<><h1>Preview</h1><p>Choose your project first.</p><a className="btn" href="/project">Choose project</a></>);
  const project = PROJECT_OPTIONS.find((o) => o.type === type)!;
  const answered = allQuestionsAnswered(type, state.answers);
  const permit = permitRequired(type, factsFor(type, state.answers));
  const unusual = unusualFromAnswers(type, state.answers);
  const guide = GUIDE[type] ?? GUIDE.default!;

  return (
    <>
      <h1>Preview</h1>
      <p className="lead">{project.label}. A few questions tell us whether a permit is likely needed and which documents apply.</p>
      <Questions questions={questionsFor(type)} answers={state.answers}
        onChange={(id, a) => { const next = { ...state.answers }; if (a === undefined) delete next[id]; else next[id] = a; set({ answers: next }); }} />

      {!answered && <p className="muted" role="status" style={{ marginTop: 16 }}>Answer every question to continue.</p>}
      {answered && permit === false && (
        <div className="banner ok" role="status" style={{ marginTop: 20 }}>
          <span className="icon" aria-hidden>✓</span>
          <div>
            <strong>A permit may not be required</strong>
            <p>{permitExplanation(type)} Based on your answers, you don&apos;t need to prepare an application.</p>
            <p>Other rules (such as zoning) may still apply. Confirm with the City before you start: <ExtLink href={guide.url}>{guide.label}</ExtLink>.</p>
          </div>
        </div>
      )}
      {answered && permit === true && (
        <div className="banner info" role="status" style={{ marginTop: 20 }}>
          <span className="icon" aria-hidden>i</span>
          <div><strong>A building permit is likely required</strong><p>Continue to enter your application details and upload your documents.</p></div>
        </div>
      )}
      {answered && permit === "unknown" && (
        <div className="banner info" role="status" style={{ marginTop: 20 }}>
          <span className="icon" aria-hidden>i</span>
          <div><strong>We can&apos;t tell yet whether a permit is required</strong><p>{permitExplanation(type)} You can continue and prepare your application; confirm with the City.</p></div>
        </div>
      )}
      {answered && unusual.length > 0 && (
        <div className="banner info" role="status" style={{ marginTop: 12 }}>
          <span className="icon" aria-hidden>i</span>
          <div><strong>Staff guidance recommended</strong><p>{unusual.join(", ")} is not covered by the simplified checklist. Contact the City&apos;s Building Division about this part of your project.</p></div>
        </div>
      )}
      <StepFooter back="/project" onContinue={() => router.push("/application")}
        continueDisabled={!answered || permit === false} />
    </>
  );
}

"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { classify, TYPE_LABELS } from "@permit/engine";
import type { QuestionnaireAnswers } from "@permit/schema";
import { useStore } from "../../lib/store";


interface Option { value: string; label: string; help?: string }
interface Step {
  key: keyof QuestionnaireAnswers;
  question: string;
  help?: string;
  options?: Option[];
  number?: { unit: string; min: number; step: number };
  show?: (a: QuestionnaireAnswers) => boolean;
}

const YES_NO: Option[] = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "unsure", label: "Not sure" }];

const STEPS: Step[] = [
  { key: "buildingKind", question: "What kind of building is this for?", options: [
    { value: "house", label: "A house (detached, semi or townhouse)" },
    { value: "commercial_unit", label: "A store, office, restaurant or other business unit" },
    { value: "industrial", label: "An industrial building" },
    { value: "institutional", label: "A school, clinic or other institution" },
    { value: "unsure", label: "Not sure" },
  ]},
  { key: "workKind", question: "What are you planning to do?", options: [
    { value: "finish_basement", label: "Finish or renovate a basement" },
    { value: "deck_or_porch", label: "Build a deck or porch" },
    { value: "garage_or_shed", label: "Build a detached garage or shed" },
    { value: "addition", label: "Build an addition onto the house" },
    { value: "solar", label: "Install solar panels" },
    { value: "interior_alteration", label: "Change the inside of a business unit" },
    { value: "other", label: "Something else" },
    { value: "unsure", label: "Not sure" },
  ]},
  { key: "deckHeightMetres", question: "How high will the deck be at its highest point above the ground?",
    help: "Measure from the ground to the top of the deck floor. 24 inches is about 0.61 metres.",
    number: { unit: "metres", min: 0, step: 0.01 }, show: (a) => a.workKind === "deck_or_porch" },
  { key: "permanentRoof", question: "Will the deck or porch have a permanent roof?", options: YES_NO, show: (a) => a.workKind === "deck_or_porch" },
  { key: "solarMountedToBuilding", question: "Will the panels be mounted on a building or structure?", options: YES_NO, show: (a) => a.workKind === "solar" },
  { key: "solarAreaM2", question: "What is the total face area of all the panels?", help: "Add up the area of every panel. A typical panel is about 2 m².",
    number: { unit: "square metres", min: 0, step: 0.1 }, show: (a) => a.workKind === "solar" },
  { key: "hasKitchenOrBathroom", question: "Will you add a kitchen or bathroom?", options: YES_NO, show: (a) => a.workKind === "finish_basement" },
  { key: "removesStructuralElement", question: "Will you remove or change a wall, beam or post that holds up the house?", options: YES_NO,
    show: (a) => a.workKind === "finish_basement" || a.workKind === "addition" },
  { key: "changeOfUse", question: "Will the business use be different from the previous use?",
    help: "For example, turning a store into a restaurant.", options: YES_NO, show: (a) => a.workKind === "interior_alteration" },
  { key: "multiUnitOrHeritage", question: "Is the property a heritage property or does it have more than one unit?", options: YES_NO },
];

export default function ClassifyPage() {
  const router = useRouter();
  const { state, set } = useStore();
  const [answers, setAnswers] = useState<QuestionnaireAnswers>(state.answers);
  const steps = STEPS.filter((s) => !s.show || s.show(answers));
  const [i, setI] = useState(0);
  const step = steps[Math.min(i, steps.length - 1)]!;
  const done = i >= steps.length;
  const result = done ? classify(answers) : null;

  function answer(v: string | number | undefined) {
    setAnswers((a) => ({ ...a, [step.key]: v }));
  }
  const current = answers[step.key];

  if (done && result) {
    const permit = result.permitRequired === true ? "A permit is likely required" : result.permitRequired === false ? "A permit may not be required" : "We need more information";
    return (
      <>
        <h1>Your project</h1>
        <div className={`banner ${result.projectType ? (result.permitRequired === false ? "ok" : "info") : "warn"}`} role="status">
          <span className="icon" aria-hidden>{result.projectType ? "ℹ" : "?"}</span>
          <div>
            <strong>{result.projectType ? TYPE_LABELS[result.projectType] : "More information required"}</strong>
            <p>{result.projectType ? permit : "We could not match your project to one of the types this prototype covers."}</p>
          </div>
        </div>
        <div className="card">
          <h3>Why</h3>
          <ul>{result.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          {result.unusualAspects.length > 0 && (
            <p><strong>Talk to City staff:</strong> {result.unusualAspects.join(", ")} is not covered by the simplified rules. Staff guidance is recommended.</p>
          )}
          {!result.projectType && (
            <p>Contact the City&apos;s Building Division or read <a href="https://www.kitchener.ca/development-and-construction/building-permits/apply-for-a-building-permit/">how to apply for a building permit</a>.</p>
          )}
        </div>
        <p className="row" style={{ marginTop: 16 }}>
          <button className="btn secondary" onClick={() => setI(steps.length - 1)}>Back</button>
          {result.projectType && (
            <button className="btn" onClick={() => { set({ answers, classification: result, report: null, review: null, demoId: undefined }); router.push("/checklist"); }}>
              See my checklist
            </button>
          )}
        </p>
      </>
    );
  }

  return (
    <>
      <p className="muted">Question {i + 1} of {steps.length}</p>
      <fieldset className="card" style={{ border: "1px solid var(--border)" }}>
        <legend><h1 style={{ fontSize: 22 }}>{step.question}</h1></legend>
        {step.help && <p className="help">{step.help}</p>}
        {step.options && (
          <div className="choices">
            {step.options.map((o) => (
              <label className="choice" key={o.value}>
                <input type="radio" name={String(step.key)} value={o.value} checked={current === o.value} onChange={() => answer(o.value)} />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        )}
        {step.number && (
          <label className="field">
            {step.number.unit}
            <input type="number" inputMode="decimal" min={step.number.min} step={step.number.step}
              value={typeof current === "number" ? current : ""}
              onChange={(e) => answer(e.target.value === "" ? undefined : Number(e.target.value))} />
            <span className="help">Leave blank if you don&apos;t know yet.</span>
          </label>
        )}
      </fieldset>
      <p className="row" style={{ marginTop: 16 }}>
        <button className="btn secondary" disabled={i === 0} onClick={() => setI(i - 1)}>Back</button>
        <button className="btn" disabled={step.options ? current === undefined : false} onClick={() => setI(i + 1)}>Next</button>
      </p>
    </>
  );
}


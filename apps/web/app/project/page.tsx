"use client";
import { useRouter } from "next/navigation";
import { PROJECT_OPTIONS } from "@permit/engine";
import { useStore } from "../../lib/store";
import { EMPTY_APPLICATION } from "../../lib/merge";
import { ProjectCombobox } from "../../components/ProjectCombobox";
import { StepFooter } from "../../components/StepFooter";

export default function ProjectPage() {
  const router = useRouter();
  const { state, set } = useStore();
  const selected = PROJECT_OPTIONS.find((o) => o.type === state.projectType);
  const query = state.projectQuery || selected?.label || "";

  function next() {
    if (!state.projectType) return;
    const a = state.application ?? EMPTY_APPLICATION(state.projectType);
    const app = {
      ...a,
      project_type: state.projectType,
      project_category: state.projectType === "ici_interior_alteration" ? "ICI" as const : state.projectType === "solar_panels" ? "Miscellaneous" as const : "Residential" as const,
    };
    set({ application: app, review: null });
    router.push("/application");
  }

  return (
    <>
      <h1>Your project</h1>
      <p className="lead">Tell us what kind of work you are planning so we can show the requirements that apply.</p>
      <ProjectCombobox
        value={state.projectType}
        query={query}
        onQuery={(q) => set({ projectQuery: q })}
        onSelect={(t) => set({ projectType: t, answers: t === state.projectType ? state.answers : {}, checks: t === state.projectType ? state.checks : {} })}
      />
      {selected && (
        <div className="card selected-project" role="status">
          <strong>Selected: {selected.label}</strong>
          <div className="muted">{selected.description}</div>
        </div>
      )}
      <details style={{ marginTop: 20 }}>
        <summary>My project isn&apos;t listed</summary>
        <p>
          This checker covers the most common residential projects and commercial interior alterations. For other work,
          see <a href="https://www.kitchener.ca/development-and-construction/building-permits/apply-for-a-building-permit/">how to apply for a building permit</a>{" "}
          or contact the City&apos;s Building Division. Staff guidance is recommended.
        </p>
      </details>
      <StepFooter back="/" onContinue={next} continueDisabled={!state.projectType} />
    </>
  );
}

"use client";
import { useRouter } from "next/navigation";
import { PROJECT_OPTIONS } from "@permit/engine";
import { useStore, useVisit } from "../../lib/store";
import { ProjectCombobox } from "../../components/ProjectCombobox";
import { StepFooter } from "../../components/StepFooter";
import { ExtLink } from "../../components/ExtLink";

export default function ProjectPage() {
  useVisit("/project");
  const router = useRouter();
  const { state, set } = useStore();
  const selected = PROJECT_OPTIONS.find((o) => o.type === state.projectType);
  const query = state.projectQuery || selected?.label || "";

  return (
    <>
      <h1>Your project</h1>
      <p className="lead">Tell us what kind of work you are planning so we can show the requirements that apply.</p>
      <ProjectCombobox
        value={state.projectType}
        query={query}
        onQuery={(q) => set({ projectQuery: q })}
        onSelect={(t) => {
          if (t === state.projectType) return;
          // a different project means different questions and documents
          set({ projectType: t, answers: {}, application: null, visited: state.visited.filter((v) => v === "/project") });
        }}
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
          This checker covers the most common residential projects and commercial interior alterations. For other work, see{" "}
          <ExtLink href="https://www.kitchener.ca/development-and-construction/building-permits/apply-for-a-building-permit/">how to apply for a building permit</ExtLink>{" "}
          or contact the City&apos;s Building Division. Staff guidance is recommended.
        </p>
      </details>
      <StepFooter back="/" onContinue={() => router.push("/preview")} continueDisabled={!state.projectType} />
    </>
  );
}

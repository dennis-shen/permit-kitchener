"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PROJECT_OPTIONS } from "@permit/engine";
import { PROJECT_TYPE_CATEGORY, type ApplicationInfo } from "@permit/schema";
import { useStore, useVisit } from "../../lib/store";
import { StepFooter } from "../../components/StepFooter";

const ROLES = ["Property owner", "Tenant", "Authorized agent (contractor or designer)", "Other"];

const EMPTY_APPLICATION = (type: ApplicationInfo["project_type"]): ApplicationInfo => ({
  application_id: "APP-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
  applicant_name: "", property_address: "", applicant_role: "Property owner",
  project_category: PROJECT_TYPE_CATEGORY[type],
  project_type: type, project_description: "", estimated_construction_value: 0, submission_method: "Online",
  submission_date: new Date().toISOString().slice(0, 10),
  // confirmed later, in the Declaration step
  declaration_completed: false, signature_present: false,
});

export default function ApplicationPage() {
  useVisit("/application");
  const router = useRouter();
  const { state, set, hydrated } = useStore();
  const [app, setApp] = useState<ApplicationInfo | null>(state.application);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { if (hydrated && !app) setApp(state.application ?? (state.projectType ? EMPTY_APPLICATION(state.projectType) : null)); }, [hydrated, state.application, state.projectType, app]);

  if (!hydrated) return null;
  if (!state.projectType || !app) {
    return (<><h1>Application information</h1><p>Choose your project first.</p><a className="btn" href="/project">Choose project</a></>);
  }
  const project = PROJECT_OPTIONS.find((o) => o.type === state.projectType)!;

  function validate(a: ApplicationInfo) {
    const e: Record<string, string> = {};
    if (!a.applicant_name.trim()) e.applicant_name = "Enter the applicant's name.";
    if (!a.property_address.trim()) e.property_address = "Enter the address of the property where the work will happen.";
    if (!a.project_description.trim()) e.project_description = "Describe the work.";
    if (!(a.estimated_construction_value > 0)) e.estimated_construction_value = "Enter an estimated construction value.";
    if (!a.submission_date) e.submission_date = "Enter the application date.";
    return e;
  }
  function next() {
    const e = validate(app!);
    setErrors(e);
    if (Object.keys(e).length) { document.getElementById("error-summary")?.focus(); return; }
    set({ application: app! });
    router.push("/requirements");
  }

  const field = (k: keyof ApplicationInfo, label: string, help?: string, type = "text") => (
    <label className="field">
      {label} <span className="req" aria-hidden>*</span>
      <input type={type} value={String(app[k] ?? "")} aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `err-${k}` : undefined}
        onChange={(e) => setApp({ ...app, [k]: type === "number" ? Number(e.target.value) : e.target.value })} />
      {help && <span className="help">{help}</span>}
      {errors[k] && <span className="error-text" id={`err-${k}`}>{errors[k]}</span>}
    </label>
  );

  return (
    <>
      <h1>Application information</h1>
      <p className="lead">{project.label}. Enter the details exactly as they appear on your application form. You&apos;ll sign the declaration at the end.</p>
      {Object.keys(errors).length > 0 && (
        <div className="banner bad" role="alert" tabIndex={-1} id="error-summary">
          <span className="icon" aria-hidden>!</span>
          <div><strong>Some information is missing</strong><ul style={{ margin: "6px 0 0" }}>{Object.values(errors).map((m) => <li key={m}>{m}</li>)}</ul></div>
        </div>
      )}
      <div className="card grid two">
        {field("applicant_name", "Applicant full name")}
        {state.projectType === "ici_interior_alteration" && (
          <label className="field">
            Business or organisation
            <input value={app.applicant_organisation ?? ""} onChange={(e) => setApp({ ...app, applicant_organisation: e.target.value })} />
          </label>
        )}
        <label className="field">
          Your role <span className="req" aria-hidden>*</span>
          <select value={ROLES.includes(app.applicant_role) ? app.applicant_role : "Other"} onChange={(e) => setApp({ ...app, applicant_role: e.target.value })}>
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
        {field("property_address", "Property address", "Street number, street name and unit, for example “123 Sample Street, Kitchener”.")}
        {field("estimated_construction_value", "Estimated construction value ($)", undefined, "number")}
        {field("submission_date", "Application date", undefined, "date")}
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          Description of proposed work <span className="req" aria-hidden>*</span>
          <textarea rows={3} value={app.project_description} aria-invalid={!!errors.project_description}
            onChange={(e) => setApp({ ...app, project_description: e.target.value })} />
          <span className="help">Describe all the work, including anything you will remove or change.</span>
          {errors.project_description && <span className="error-text">{errors.project_description}</span>}
        </label>
      </div>
      <p className="muted" style={{ fontSize: 15 }}><span className="req">*</span> Required to continue.</p>
      <StepFooter back="/preview" onContinue={next} />
    </>
  );
}

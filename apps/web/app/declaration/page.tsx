"use client";
import { useRouter } from "next/navigation";
import { documentPages } from "@permit/engine";
import { useStore, useVisit, type Declaration } from "../../lib/store";
import { factsFor, foundOnUploads } from "../../lib/review";
import { StepFooter } from "../../components/StepFooter";
import { ExtLink } from "../../components/ExtLink";

const FORM_URL = "https://www.ontario.ca/files/2026-01/mmah-building-development-application-for-a-permit-to-construct-or-demolish-2026-en-2026-01-27.pdf";

/**
 * Declaration of applicant (Ontario form, Section I) and, where they apply, the corporation authority
 * statement and the designer's Schedule 1 declaration. All shown items are required.
 * The signature itself belongs on the PDF form; the reviewer checks the uploaded form for it.
 * Anything already found on an uploaded form (Section I's declaration and signature, the Schedule 1 designer
 * signature) is not asked again here.
 */
export default function DeclarationPage() {
  useVisit("/declaration");
  const router = useRouter();
  const { state, set, hydrated, files, reviews } = useStore();
  if (!hydrated) return null;
  const a = state.application;
  const type = state.projectType;
  if (!a || !type) return (<><h1>Declaration</h1><p>Complete the earlier steps first.</p><a className="btn" href="/project">Start</a></>);

  const d = state.declaration;
  const needsAuthority = !!a.applicant_organisation?.trim();
  // Schedule 1 (designer information) is part of the application form for ICI and HVAC projects.
  const needsDesigner = documentPages(type, factsFor(type, state.answers))
    .some((p) => p.items.some((i) => i.requirementId === "ici.designer" || i.requirementId === "hvac.designer_declaration"));
  const found = foundOnUploads(type, state.answers, files, reviews);
  const onForm = {
    declared: found.has("general.application.declaration_completed"), // Section I, including the authority statement
    signed: found.has("general.application.signature_present"),
    designer: found.has("hvac.designer_declaration.signature"), // Schedule 1, Section D
  };
  const askDeclared = !onForm.declared;
  const askSigned = !onForm.signed;
  const askDesigner = needsDesigner && !onForm.designer;
  const covered = [
    onForm.declared && "the declaration of applicant (Section I)",
    onForm.signed && "the applicant's signature and date (Section I)",
    needsDesigner && onForm.designer && "the designer's declaration and signature (Schedule 1)",
  ].filter(Boolean) as string[];
  const update = (patch: Partial<Declaration>) => set({ declaration: { ...d, ...patch } });
  const nameOk = d.name.trim() !== "";
  const ready = (!askDeclared || (nameOk && d.declared && (!needsAuthority || d.authority))) && (!askSigned || d.signed) && (!askDesigner || d.designer);

  function next() {
    if (!ready) return;
    set({
      application: { ...a!, declaration_completed: true, signature_present: true },
      declaration: { ...d, declared: true, signed: true, authority: d.authority || !askDeclared, designer: d.designer || !askDesigner },
    });
    router.push("/summary");
  }

  return (
    <>
      <h1>Declaration</h1>
      <p className="lead">The last part of the application form. Every item on this page is required.</p>
      {covered.length > 0 && (
        <div className="banner ok" style={{ marginBottom: 14 }}>
          <span className="icon" aria-hidden>✓</span>
          <div>
            <strong>Already on your uploaded form</strong>
            <p>We found {covered.length > 1 ? `${covered.slice(0, -1).join(", ")} and ${covered.at(-1)}` : covered[0]} on the PDF you uploaded, so {covered.length > 1 ? "they are" : "it is"} not asked again here.</p>
          </div>
        </div>
      )}
      {(askDeclared || askSigned) && (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Declaration of applicant</h2>
        <p className="muted" style={{ marginTop: 0 }}>Section I of the <ExtLink href={FORM_URL}>Application for a Permit to Construct or Demolish</ExtLink>.</p>
        {askDeclared && (<>
        <label className="field">
          I (full name, as printed in the declaration) <span className="req" aria-hidden>*</span>
          <input value={d.name} onChange={(e) => update({ name: e.target.value })} />
        </label>
        <label className="check" style={{ marginBottom: 12 }}>
          <input type="checkbox" checked={d.declared} onChange={(e) => update({ declared: e.target.checked })} required />
          <span>declare that the information contained in this application, attached schedules, attached plans and specifications, and other attached documentation is true to the best of my knowledge. <span className="req" aria-hidden>*</span></span>
        </label>
        {needsAuthority && (
          <label className="check" style={{ marginBottom: 12 }}>
            <input type="checkbox" checked={d.authority} onChange={(e) => update({ authority: e.target.checked })} required />
            <span>As {a.applicant_organisation} is a corporation or partnership, I have the authority to bind the corporation or partnership. <span className="req" aria-hidden>*</span></span>
          </label>
        )}
        </>)}
        {askSigned && (
        <label className="check">
          <input type="checkbox" checked={d.signed} onChange={(e) => update({ signed: e.target.checked })} required />
          <span>I have signed and dated Section I (&quot;Signature of applicant&quot; and &quot;Date&quot;) on the application form PDF I uploaded. <span className="req" aria-hidden>*</span></span>
        </label>
        )}
      </div>
      )}

      {askDesigner && (
        <div className="card" style={{ marginTop: 14 }}>
          <h2 style={{ marginTop: 0 }}>Designer declaration</h2>
          <p className="muted" style={{ marginTop: 0 }}>Schedule 1 (Designer information), Section D, of the same form.</p>
          <label className="check">
            <input type="checkbox" checked={d.designer} onChange={(e) => update({ designer: e.target.checked })} required />
            <span>The designer who reviews and takes responsibility for the design has completed, signed and dated Schedule 1. <span className="req" aria-hidden>*</span></span>
          </label>
        </div>
      )}

      {askSigned && (
      <div className="banner info" style={{ marginTop: 18 }}>
        <span className="icon" aria-hidden>i</span>
        <div>
          <strong>Your signature belongs on the PDF</strong>
          <p>Sign and date Section I of your uploaded application form.</p>
        </div>
      </div>
      )}
      {!askDeclared && !askSigned && !askDesigner && <p>Nothing more to declare. Continue to your summary.</p>}
      {!ready && <p className="muted" role="status">Complete every item marked * to continue.</p>}
      <StepFooter back="/requirements" onContinue={next} continueDisabled={!ready} />
    </>
  );
}

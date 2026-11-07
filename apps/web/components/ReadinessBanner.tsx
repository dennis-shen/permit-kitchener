import type { ReadinessReport } from "@permit/schema";

const STYLE = {
  appears_ready: ["ok", "✓", "No missing items were identified using the simplified requirements."],
  action_required: ["bad", "!", "One or more required items are incomplete or missing."],
  more_info_required: ["warn", "?", "We could not classify the project from the information provided."],
  staff_guidance_recommended: ["info", "i", "Part of this project isn't covered by the simplified requirements. Talk to City staff."],
} as const;

export function ReadinessBanner({ report }: { report: ReadinessReport }) {
  const [cls, icon, text] = STYLE[report.readiness];
  return (
    <div className={`banner ${cls}`} role="status" aria-live="polite" tabIndex={-1} id="readiness">
      <span className="icon" aria-hidden>{icon}</span>
      <div>
        <strong>{report.readiness_label}</strong>
        <p>{text}</p>
        <p style={{ fontSize: 15 }}>{report.disclaimer}</p>
      </div>
    </div>
  );
}

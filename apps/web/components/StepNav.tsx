"use client";
import { usePathname } from "next/navigation";
import { useStore } from "../lib/store";

export const STEPS = [
  { href: "/project", label: "Project" },
  { href: "/preview", label: "Preview" },
  { href: "/application", label: "Application" },
  { href: "/requirements", label: "Requirements & uploads" },
  { href: "/declaration", label: "Declaration" },
  { href: "/summary", label: "Summary" },
  { href: "/confirmation", label: "Confirmation" },
] as const;

/** Shows which section the applicant is on. A section is a link only once it has been visited. */
export function StepNav() {
  const path = usePathname();
  const { state } = useStore();
  const current = STEPS.findIndex((s) => s.href === path);
  if (current < 0) return null;
  return (
    <nav className="steps" aria-label="Application steps">
      <ol>
        {STEPS.map((s, i) => {
          const visited = state.visited.includes(s.href);
          const inner = <><span className="num">{i + 1}</span>{s.label}</>;
          return (
            <li key={s.href}>
              {i === current ? (
                <a href={s.href} aria-current="step">{inner}</a>
              ) : visited ? (
                <a href={s.href} className="done">{inner}</a>
              ) : (
                <span className="step" aria-disabled="true">{inner}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

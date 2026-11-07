"use client";
import { usePathname } from "next/navigation";

export const STEPS = [
  { href: "/project", label: "Project" },
  { href: "/application", label: "Application" },
  { href: "/requirements", label: "Requirements & uploads" },
  { href: "/results", label: "Results" },
  { href: "/summary", label: "Summary" },
] as const;

/** Shows which section the applicant is on. Earlier steps are links; later ones are plain text. */
export function StepNav() {
  const path = usePathname();
  const current = STEPS.findIndex((s) => s.href === path);
  if (current < 0) return null;
  return (
    <nav className="steps" aria-label="Application steps">
      <ol>
        {STEPS.map((s, i) => (
          <li key={s.href}>
            {i < current ? (
              <a href={s.href} className="done"><span className="num">{i + 1}</span>{s.label}</a>
            ) : i === current ? (
              <a href={s.href} aria-current="step"><span className="num">{i + 1}</span>{s.label}</a>
            ) : (
              <span className="step"><span className="num">{i + 1}</span>{s.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

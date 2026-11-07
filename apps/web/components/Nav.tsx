"use client";
import { usePathname } from "next/navigation";

const STEPS = [
  ["/classify", "1. Project"],
  ["/checklist", "2. Checklist"],
  ["/check", "3. Upload"],
  ["/results", "4. Results"],
  ["/summary", "5. Summary"],
] as const;

export function Nav() {
  const path = usePathname();
  return (
    <nav className="steps" aria-label="Steps">
      {STEPS.map(([href, label]) => (
        <a key={href} href={href} aria-current={path === href ? "page" : undefined}>{label}</a>
      ))}
    </nav>
  );
}

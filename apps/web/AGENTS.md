# AGENTS.md: web app (apps/web)

This adds to the root `AGENTS.md`. It is Next.js 14 (App Router) with plain CSS in `app/globals.css`, no CSS framework.

## Pages (in step order)
`/` (start and sample applications) → `/project` (combobox) → `/application` → `/requirements` (threshold questions, then a checklist with a per-requirement upload) → `/results` → `/summary` (PDF download via `lib/pdf.ts` with pdf-lib).

## Rules
- Light theme only. Colours are CSS variables at the top of `globals.css` (Kitchener green `#004D44`, black on white). High contrast is `:root[data-contrast="high"]`, toggled by `components/ContrastToggle.tsx`. Don't add a dark mode.
- The step bar (`components/StepNav.tsx`) shows the current section. Every step ends with `components/StepFooter.tsx` (Back / Continue).
- State is in `lib/store.tsx`. Uploaded files stay in memory only (never in sessionStorage). Threshold answers and ticks are persisted.
- `lib/merge.ts` turns the review into an engine report. Don't duplicate engine logic in components.
- Every upload slot sends its requirement's document type to the reviewer as `document_hints`.
- Accessibility: WCAG 2.1 AA. Status is never shown by colour alone, everything is keyboard reachable, and there's no horizontal scroll at 390px. The axe and phone-width checks are in `tests/e2e`.
- Don't use the words "prototype", "approved" or "compliant" in UI copy.

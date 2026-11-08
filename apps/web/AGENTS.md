# AGENTS.md: web app (apps/web)

This adds to the root `AGENTS.md`. It is Next.js 14 (App Router) with plain CSS in `app/globals.css`, no CSS framework.

## Pages (in step order)
`/` (start and sample applications) → `/project` (combobox) → `/preview` (threshold questions and the permit result) → `/application` (details, full name, no declaration) → `/requirements` (one PDF per page) → `/declaration` (required statements) → `/summary` (unfinished items with links back, PDF download via `lib/pdf.ts`) → `/confirmation`.

## How the requirements step works
- Pages come from `documentPages(type, facts)` in `@permit/engine`: requirements grouped by `documentType`, in data order. `/requirements?page=<documentType>` opens a specific page (the Summary links use this).
- Each page holds one uploaded PDF (`files[documentType]` in `lib/store.tsx`, memory only). On upload, `lib/review.ts → checkPage()` sends just that file to the reviewer with `document_hints` set to the page's type. The result goes in `reviews[documentType]`.
- **Placeholder mode:** `PLACEHOLDER_TICKS = true` in `lib/review.ts` ticks every item on a page once its PDF is uploaded, and `buildReport()` treats that PDF as showing all of its page's items. The reviewer is still called for file problems. Set the flag to `false` to use the reviewer's per-field results.
- `pageChecks()` turns a result into per-field states: `pending` (no file), `checking`, `found`, `not_found`. A field is ticked **only** from the PDF on that page; never use application details, preview answers or the declaration to tick anything.
- Each review is tied to the exact file it ran on (`PageReview.file`; read it through `currentReview()`). Results for a replaced or removed file are discarded, so quick re-uploads can't show stale ticks.
- `buildReport()` combines every page, the application details, the declaration and the preview answers into one engine report. Summary and Confirmation both use it.
- Next on an incomplete page opens the native `<dialog>` ("Continue anyway" / "Stay on this page"). The bottom progress bar lists every page with its status.

## Rules
- Light theme only: CSS variables at the top of `globals.css` (Kitchener green `#004D44`, black on white) and the Manrope font from Google Fonts. No dark mode and no contrast toggle.
- Use `components/ExtLink.tsx` for every external link (new tab, with "(opens in a new tab)" for screen readers).
- `components/StepNav.tsx`: a step is a link only if `state.visited` includes it. Pages call `useVisit(path)`.
- State is in `lib/store.tsx`. Preview answers, application, declaration and visited steps go in sessionStorage; files and check results stay in memory.
- Accessibility: WCAG 2.1 AA. Status is never shown by colour alone (an icon plus screen-reader text), everything is keyboard reachable, and there's no horizontal scroll at 390px. The axe and phone-width checks are in `tests/e2e`.
- Don't use the words "prototype", "approved" or "compliant" in UI copy.

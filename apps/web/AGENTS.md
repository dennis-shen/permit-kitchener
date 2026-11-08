# AGENTS.md: web app (apps/web)

This adds to the root `AGENTS.md`. It is Next.js 16 (App Router, React 19, Turbopack) with plain CSS in `app/globals.css`, no CSS framework.

## Pages (in step order)
`/` (start and sample applications) → `/project` (combobox) → `/preview` (threshold questions and the permit result) → `/application` (details, full name, no declaration) → `/requirements` (one PDF per page) → `/declaration` (required statements) → `/summary` (unfinished items with links back, PDF download via `lib/pdf.ts`) → `/confirmation`.

## How the requirements step works
- Pages come from `documentPages(type, facts)` in `@permit/engine`: requirements grouped by `documentType`, in data order. `/requirements?page=<documentType>` opens a specific page (the Summary links use this).
- Each page holds one uploaded PDF, **saved on the server**: `upload(page, file)` in `lib/store.tsx` sends it to `/api/files/<page>` (→ `services/review`, which stores it for this browser session and reviews it). Every response is the session's full list (file name, size and review per page), which replaces the store's `files` / `reviews`. So uploads survive going back, full page loads, reloads and new tabs. `remove(page)` deletes one; `reset()` deletes them all.
- **Placeholder mode:** `PLACEHOLDER_TICKS = true` in `lib/review.ts` ticks every item on a page once its PDF is uploaded, and `buildReport()` treats that PDF as showing all of its page's items. The review service is still called for file problems. Set the flag to `false` once the custom review API fills `shown_details`.
- How a page lists its fields: `pageGroups(page)` (engine) groups them by form section when the document has `sections` (the application form, in form order) and the page spans two or more; otherwise one group per requirement. Each group is a collapsible block with a count. Before an upload (and while checking) every block is closed and lists all its fields. Once the PDF's result is in, a block with unfinished fields opens and lists only those (its completed and blank "(if applicable)" fields fold into "Completed in this section (n)"); a block with nothing unfinished stays closed and is marked done.
- `pageChecks()` turns a result into per-field states: `pending` (no file), `checking`, `found`, `not_found`. A field is ticked **only** from the PDF on that page; never use application details, preview answers or the declaration to tick anything.
- While a file is being saved its page shows "Saving and checking the file…"; if saving fails it shows that the file was not saved. The same file on two pages is reported by the service (InfoPkg duplicate message, plus which other page via `problemText()` in `lib/review.ts`).
- `buildReport()` combines every page, the application details, the declaration and the preview answers into one engine report. Summary and Confirmation both use it.
- Next on an incomplete page opens the native `<dialog>` ("Continue anyway" / "Stay on this page"). The bottom progress bar lists every page with its status.

## Rules
- Light theme only: CSS variables at the top of `globals.css` (Kitchener green `#004D44`, black on white) and the Manrope font from Google Fonts. No dark mode and no contrast toggle.
- Use `components/ExtLink.tsx` for every external link (new tab, with "(opens in a new tab)" for screen readers).
- `components/StepNav.tsx`: a step is a link only if `state.visited` includes it. Pages call `useVisit(path)`.
- State is in `lib/store.tsx`. Preview answers, application, declaration and visited steps go in localStorage; files live on the server (the browser keeps only their names and sizes).
- Accessibility: WCAG 2.1 AA. Status is never shown by colour alone (an icon plus screen-reader text), everything is keyboard reachable, and there's no horizontal scroll at 390px. The axe and phone-width checks are in `tests/e2e`.
- Don't use the words "prototype", "approved" or "compliant" in UI copy.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

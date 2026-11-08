# Schedule 1 BCIN review and checking indicator

The branch includes `claude/bold-pascal-boziq8` at `4058495`, merged in `9a93632`. Two content conflicts were resolved by retaining the production image/boolean pipeline and strict fixture tests while adopting the incoming two-upload HVAC flow: the application form includes Schedule 1, followed by the heat-loss/gain document. No unresolved conflicts remain.

The attached `03_CORRECT_Permit-Application_Ontario_Sample-A.pdf` was inspected by rendering its pages, without OCR or text extraction. Its Schedule 1 selects the registered-firm declaration and fills the first Individual BCIN box; the second box belongs to the unselected “other designer” declaration. The unused alternative is allowed to remain blank.

The supplied value is explicitly a test placeholder, and the signature fields explicitly state that they are not signed. A live review of the original returned no BCIN or designer-signature tick. Replacing only the first BCIN with a plausible synthetic numeric value made that BCIN tick while the second stayed blank. Thus, a requirement to fill both boxes was not reproduced on this sample. No registration or credential authenticity was verified, and the attachment has not been committed.

The requirement guidance now identifies the selected declaration's first/second BCIN box explicitly. Tests with simpler forms exposed additional model false positives for placeholders and unmarked choices. BCIN fields are now evaluated in their own focused strict boolean schema, separately from the other form fields, to keep repeated boxes and their selected declaration in view. The focused pass checks a visible checkbox selection, the applicable box location, and numeric format independently and combines them with AND. Test markers in other fields or in the document footer do not invalidate a numeric entry in the requested box. Both calls share the original deadline; a failed or malformed BCIN response discards the entire review. The cache version was changed to invalidate earlier decisions.

The checking indicator is a 20 px spinner beside “Saving and checking the file…” under the current upload. It does not cover the page or steal focus. The existing polite status text supplies its accessible meaning; the decorative spinner is hidden from assistive technology. Animation stops when reduced motion is requested. A browser test holds the upload response to check the spinner, pending ticks, disabled Next button, reduced motion and accessibility, then verifies that the spinner disappears when the response arrives.

The opt-in live regression command is:

```sh
pnpm dev
# In another terminal:
uv run python scripts/live_bcin_smoke.py
```

It sends typed and scanned synthetic declarations through the production review service. Cases cover the first/second selected BCIN, a number in the wrong branch, missing BCIN, a test placeholder and no selected declaration choice. Artifacts and results are saved only in ignored `work/bcin-smoke/`. The script uses no credential directly and never returns an extracted field value.

Validation includes a production build, TypeScript typecheck and lint; 156 TypeScript tests, 36 Python review tests, and 25 Chromium browser tests pass. The spinner browser test also checks reduced motion and serious accessibility violations. The browser regression service uses deterministic decisions; the separate BCIN smoke tests use the real AI SDK/Gateway pipeline.

A single aggregate BCIN judgement still occasionally confused a numeric example with test markers elsewhere on the full form, or inferred a declaration choice from a filled number. The final implementation therefore asks the visual model for separate checkbox-selection, location, and numeric-format booleans, with instructions scoped to that particular box, and combines them in code. Unit tests enforce both conditions and discard partial/malformed verification output. It adds one focused SDK call for a document with BCIN fields; the public response still contains only the original requirement IDs and booleans.

Final live validation: **12/12 typed/scanned BCIN cases passed** through the production review service and Vercel AI Gateway. Rechecking the supplied four-page form kept its BCIN placeholder and unsigned signature unticked; replacing only the first BCIN with a numeric test value made that BCIN tick while the unused second box remained blank. No unavailable-review responses occurred in this final run. As with other visual model checks, these are bounded synthetic regressions, not a guarantee for every possible document layout.

# 3-minute demo

1. **Problem (20 s).** Incomplete applications mean back-and-forth with City staff and delays. Applicants don't know what applies to them.
2. **Classify (30 s).** Start my project → House → Build a deck → height 0.4 m → no roof. Show "A permit may not be required — confirm with the City". Back, change to 0.9 m: permit likely required. See my checklist: every item links to the City page.
3. **Review real drawings (60 s).** Home → *Residential deck* demo → Review my documents. The service reads the four PDFs: **Action required**, with the six InfoPkg messages (signature, property lines, shed, beam, joists, side view). Open "Beam information is incomplete" → **Show me where** highlights the bare "BEAM" label on the deck plan, with the City reference.
4. **Control (20 s).** *Complete deck (control)* → **Appears ready to submit**, zero findings. No false positives.
5. **Wrong / inconsistent files (30 s).** *Detached garage* demo, add `fixtures/files/FILE-002/ProtectedPlan.pdf` and `FILE-006/GaragePlan.pdf` → "Upload an unsecured version of the PDF." and an address mismatch showing both addresses side by side.
6. **Scans (10 s).** The same checks pass on noisy, skewed scans (`fixtures/drawings/scanned`) via OpenCV + OCR.
7. **Close (10 s).** Printable summary for the applicant, the same view for staff. Preliminary guidance only — supports, never replaces, City review.

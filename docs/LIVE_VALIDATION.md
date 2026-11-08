# Live Gateway validation — November 8, 2026

Validation started from `1add096` on `agent/codex/ai-gateway-pdf-decisions`, using the managed cloud instance with `ai-gateway.vercel.sh` allowed. The credential was installed only in the ignored root `.env.local` with owner-only permissions. No credential or provider error payload is included in this report.

## Connectivity and model eligibility

- The Gateway's public `GET /v1/models` returned HTTP 200. Its model entry supports images and structured outputs for `google/gemini-2.5-flash-lite`.
- Authenticated `GET /v1/models?include_availability` returned `model_eligibility.status: eligible`, HTTP runtime `available`, and availability evaluation `complete` for the supplied credential.
- Current [pricing documentation](https://vercel.com/docs/ai-gateway/pricing) describes $5/month of free credits for an eligible subset of models, with lower rate limits. Eligibility was checked for this team using the documented [availability API](https://vercel.com/docs/ai-gateway/sdks-and-apis/rest-api#team-availability-annotations); this response does not identify whether a particular request consumes free or purchased credits.
- Live AI SDK calls succeeded. A diagnostic wrapper observed positive reasoning-token usage while printing token counts only. Public model pricing was $0.10/M input and $0.40/M output tokens at validation time.

## Problems found and changes

1. On this two-core instance, the original root startup scripts started web and review while the AI process remained queued. Explicit unlimited script concurrency starts all three services under both pinned pnpm 12.18.0 `dev` and `start`.
2. Live model requests initially marked blank signatures and invalid contact values as present. Stronger general instructions alone were insufficient. The requests now enable documented reasoning and add explicit visual rules for field type, value plausibility, and the field's location. Strict schemas and responses remain boolean-only; there is no OCR or text extraction.
3. The bundled control PDFs predated the current fields and used generic lines beside labels in place of actual drawing features. The four control PDFs now contain a full synthetic form and labelled site/framing/side-view geometry. Their golden scenario expectations were not changed or relaxed.
4. The successful-review cache version was increased so earlier decisions are not reused. New regression tests check cache invalidation and that a failed later page batch discards earlier positive decisions, is not cached, and is retried on reload.

## Reproduction

```sh
pnpm install
uv sync
pnpm dev
# In another terminal, using the production services, not tests/e2e/review_server.py:
uv run python scripts/live_review_smoke.py
```

The opt-in script spends Gateway credits and writes generated typed/image-only PDFs, boolean responses, and `matrix-results.json` to ignored `work/live-validation/`. It checks required positives and deliberately absent/invalid fields without accepting failed reviews. It also tests dimensions on page five, beyond the four-image batch boundary. `--write-control-fixtures` regenerates the four bundled control PDFs without network requests.

A separate live invalid-credential test used an intentionally invalid **process environment** value, leaving the real `.env.local` untouched. Both saving a fresh upload and listing it again returned a visible unavailable-review finding, zero `shown_details`, and no success-cache file. The normal AI service was restored afterward. Reproduce with the invalid process credential and `uv run python scripts/live_review_smoke.py --expect-unavailable`.

The live Chromium check used the actual web API and production review/AI services: a typed control ticked fields, replacement with a scanned unsigned form removed the signature tick, reload preserved the decisions, and removal cleared the ticks. The existing 24 browser regression tests use fixture decisions and are reported separately; they do not establish live model accuracy.

Repeated exploratory runs showed that model decisions can vary even at temperature zero. A passing bounded smoke matrix is not a guarantee for arbitrary applicant documents. The strict boolean contract and failure behavior are separately enforced and tested.

## Regression results

- Production build, TypeScript typecheck and ESLint: passed.
- TypeScript unit, golden and policy tests: **150 passed**.
- Python review tests: **37 passed**.
- Fixture-based Chromium browser regressions: **24 passed** (system Chromium, trace off).
- Live browser upload/replacement/reload/removal: passed against the real services.
- Live invalid-credential save/reload: warning, **zero ticks**, no success cache.

## Final live results

| Check | Result |
|---|---|
| Typed/scanned form variants (control, missing fields, missing signature, implausible values, placeholders, invalid formats, labels only) | 14/14 met expected presence/plausibility decisions |
| Typed/scanned site, framing and side-view drawing controls | 6/6 met expectations, no findings |
| Typed/scanned PDF with evidence only on page five | Both met expectations; scanned case required a retry |
| Raw application-form AI response | Exact 40 keys, all booleans; required a retry |
| Full typed/scanned controls passed into the real rules engine | Both: `appears_ready`, zero findings/missing items, `formal_approval: false` |

The last full matrix attempt passed all 20 primary cases and the typed page-five case. The scanned page-five case and the separate raw-form request returned HTTP 503/unavailable responses. They produced no positive decisions. Both checks passed when retried; direct SDK replays also succeeded. The specific cause of those transient failures was not established, so they are not attributed to a confirmed rate limit or proxy restriction. The latest successful response for each of the 22 PDF cases and the retry history are recorded in ignored `work/live-validation/final-results.json`.

No tests were skipped or relaxed to reach these results. The production stack was also started successfully with `pnpm start` (web 3000, review 8000, AI loopback 8101).

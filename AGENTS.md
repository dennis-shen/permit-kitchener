# AGENTS.md — contributor guide (humans and coding agents)

Read `README.md` first, then `docs/CONTRACTS.md` (interfaces) and `docs/PLAN.md` (original design).

## Rules that never change
1. **Synthetic data only.** No real names, addresses or permits.
2. **Never approve.** `formal_approval` is always `false`. No "approved", "compliant", "guaranteed" or "your application is complete" outside the disclaimer (`tests/policy` enforces this).
3. **Disclaimer** (`DISCLAIMER` in `@permit/schema`) on every result and summary screen and in every report.
4. **Link, don't copy**: requirements point to `data/resources.json`.
5. **Acceptance bar**: `tests/golden` (7 scenarios exact), vision tests (clean + scanned, FILE-001…008), E2E. A false positive on MOCK-CONTROL-001 is a release blocker.
6. Works with no API key (`VLM_PROVIDER=none`).

## Changing things
- **A requirement:** edit `data/requirements/*.json` (+ `INDEX.md`), add a pattern in `services/vision/app/patterns.py` and an annotation in `fixtures/generate.py`, then run `python3 scripts/build_scenarios.py` and `services/vision/.venv/bin/python fixtures/generate.py`.
- **A contract:** change `packages/schema` and `docs/CONTRACTS.md` together, then run `pnpm schema:json`.
- **Before a PR:** `pnpm typecheck && pnpm lint && pnpm test`, `(cd services/vision && .venv/bin/pytest -q)`, `pnpm test:e2e`.
- Commits: `<area>: <imperative summary>`.

# Design Decisions

Record of every design decision and rationale.

---

## D001: Data Store Choice - SQLite via better-sqlite3
**Date:** 2026-01-22
**Decision:** Use SQLite with better-sqlite3 (synchronous) rather than PostgreSQL or a cloud DB.
**Rationale:** Single-file database is portable, requires no server, and is fast enough for 60k rows. Synchronous API simplifies the coordinator logic. Easy to export for Python analysis.
**Alternatives Considered:** PostgreSQL (overkill), DuckDB (less ecosystem), JSON files (no queries).

## D002: Agent Differentiation - Model + Knowledge Level Only
**Date:** 2026-01-22
**Decision:** Agents differ only by model provider and knowledge level (naive/basic/expert). No personas.
**Rationale:** Clean factorial design with interpretable results. Personas would add a hard-to-control variable and multiply conditions. The knowledge level dimension already tests whether framing affects behavior.
**Alternatives Considered:** Personality prompts, risk-attitude priming, demographic personas.

## D003: Temperature = 0 for All Calls
**Date:** 2026-01-22
**Decision:** All LLM calls use temperature=0.
**Rationale:** Reproducibility is critical for a scientific study. Variance comes from the conditions, not from sampling randomness. We can run a temp>0 follow-up if deterministic results are too uniform.
**Alternatives Considered:** temp=0.3 (more natural), temp=1.0 (maximum variance).

## D004: Closed-Loop Payment System
**Date:** 2026-01-22
**Decision:** Operator funds agents before experiment, sweeps all back at end. Net sats cost ~0.
**Rationale:** Makes the experiment affordable (only LLM API costs matter). Agents still have real balances that change during play, maintaining the "real stakes" property.
**Alternatives Considered:** Each agent self-funds (complex), fixed per-game budgets (less realistic).

## D005: Response Parsing with Retry
**Date:** 2026-01-22
**Decision:** If LLM response is unparseable, send one retry prompt asking for correct format.
**Rationale:** LLMs sometimes add explanation despite instructions. One retry usually gets a clean response. More than one retry would bias results.
**Alternatives Considered:** Strict parsing only (lose data), multiple retries (bias), structured output (not all models support).

## D006: Payoff as Gross Earnings (Not Net)
**Date:** 2026-01-22
**Decision:** Payoffs are gross (earned from game), not net (minus initial stake). Agent balances are rebalanced between conditions.
**Rationale:** Cleaner analysis - each game starts from equal endowment. Prevents accumulated wealth from affecting later games.
**Alternatives Considered:** Running balance (more realistic but confounds), fixed per-round deduction.

## D007: Model Versions
**Date:** 2026-01-22
**Decision:** Claude 4.5 Sonnet (`claude-sonnet-4-5-20250514`) and GPT-4.1 as stand-in until GPT-5.2 is available.
**Rationale:** These are the current frontier models from each provider. Pin exact model IDs to ensure reproducibility.
**Alternatives Considered:** Using older models for cost savings.

## D008: Pre-Registration with Formal Hypotheses
**Date:** 2026-01-22
**Decision:** Adopt a pre-registration approach: 13 formal directional hypotheses with specific benchmarks, stated before data collection. All analyses not pre-registered are labeled "exploratory" in the paper.
**Rationale:** This is the gold standard in behavioral economics. Prevents p-hacking and HARKing (Hypothesizing After Results are Known). Reviewers will scrutinize whether findings were predicted vs. discovered post-hoc. Pre-registration dramatically increases credibility.
**Alternatives Considered:** Pure exploratory study (weaker claims), post-hoc rationalization (unethical).

## D009: Bonferroni Correction for Multiple Comparisons
**Date:** 2026-01-22
**Decision:** Apply Bonferroni correction (α = 0.05/13 = 0.0038) for the 13 confirmatory hypotheses.
**Rationale:** With 13 tests, the family-wise error rate would be inflated without correction. Bonferroni is conservative but widely accepted. FDR (Benjamini-Hochberg) used for exploratory analyses.
**Alternatives Considered:** No correction (inflated Type I error), Holm-Bonferroni (slightly less conservative), FDR only (less rigorous for confirmatory work).

## D010: Pilot for Pipeline Validation Only
**Date:** 2026-01-22
**Decision:** The pilot study validates the technical pipeline only. Pilot data is NOT used for hypothesis testing and is reported separately from the main experiment.
**Rationale:** Using pilot data for both validation and hypothesis testing is double-dipping. The pilot may reveal prompt issues or API problems that require changes, which would invalidate any statistical conclusions drawn from the same data.
**Alternatives Considered:** Combined pilot+main (methodologically problematic), no pilot (risky).

# Pre-Registered Hypotheses

This document contains all confirmatory hypotheses, stated before data collection begins.
Any analysis not listed here is exploratory and will be labeled as such in the paper.

**Date locked:** [TO BE FILLED - date of first pilot run]
**Locked by:** Paul Ferguson

---

## Primary Hypotheses (Confirmatory)

### H1: LLMs cooperate more than Nash equilibrium
**Prediction:** In the one-shot Prisoner's Dilemma, overall LLM cooperation rate will be significantly greater than 0% (Nash prediction).
**Benchmark:** Nash = 0% cooperation.
**Test:** One-sample t-test, cooperation rate > 0.
**Justification:** LLMs are trained on human text where cooperation is often presented positively. They should exhibit above-Nash prosocial behavior.

### H2: LLMs cooperate less than humans
**Prediction:** In the one-shot PD, overall LLM cooperation rate will be significantly less than 50% (human benchmark from meta-analyses).
**Benchmark:** Human one-shot PD cooperation ≈ 50% (Sally, 1995; Mengel, 2018).
**Test:** One-sample t-test, cooperation rate < 0.50.
**Justification:** LLMs lack genuine social preferences and theory of mind. They may approximate but not match human prosociality.
**Alternative (H2a):** LLMs cooperate MORE than humans (>50%) due to training on idealized cooperative text.

### H3: Stake size affects cooperation (Stake Sensitivity)
**Prediction:** Cooperation rate in PD will decrease as stake size increases from 1 to 1000 sats.
**Direction:** Negative relationship (higher stakes → less cooperation).
**Test:** Logistic regression, stake (log-transformed) predicting cooperation. Also Kruskal-Wallis across 4 stake levels.
**Justification:** In human experiments, higher stakes generally reduce cooperation and increase rational play (Camerer & Hogarth, 1999). If LLMs are sensitive to stakes, this suggests they're not just pattern-matching but processing the magnitude.
**Effect size prediction:** At least 10 percentage points difference between stake=1 and stake=1000.

### H4: Models differ in prosocial behavior
**Prediction:** Claude 4.5 and GPT-5.2 will show significantly different cooperation rates in PD.
**Direction:** No directional prediction (two-tailed test).
**Test:** Mann-Whitney U test comparing cooperation rates between models.
**Justification:** Different training data, RLHF procedures, and safety training may produce different economic "personalities."
**Effect size prediction:** Cohen's d ≥ 0.3 (small-to-medium effect).

### H5: Expert knowledge reduces cooperation
**Prediction:** Agents with "expert" knowledge (told Nash equilibrium is to defect) will cooperate less than "naive" agents.
**Direction:** Expert < Basic < Naive (in cooperation rate).
**Test:** Kruskal-Wallis across 3 knowledge levels, followed by pairwise Mann-Whitney.
**Justification:** Informing agents about Nash equilibrium provides a focal point for defection. This mirrors findings that economics students defect more than non-economists (Frank et al., 1993).

### H6: Cooperation decays in iterated PD
**Prediction:** In the 50-round iterated PD, cooperation rate in the last 10 rounds will be lower than in the first 10 rounds.
**Test:** Paired t-test comparing mean cooperation in rounds 1-10 vs. rounds 41-50.
**Justification:** Backward induction predicts unraveling from the end. Human experiments show end-game defection effects.

### H7: Ultimatum offers exceed Nash but differ from humans
**Prediction:** Mean UG offer will be significantly greater than 1% of pot (Nash) but significantly different from 40% of pot (human mean from Güth et al., 1982).
**Tests:** One-sample t-tests vs. 0.01 and vs. 0.40.
**Effect size prediction:** Mean offer between 20-60% of pot.

### H8: Trust Game investment exceeds Nash
**Prediction:** Mean investment in Trust Game will be significantly greater than 0% (Nash prediction).
**Benchmark:** Nash = 0% investment. Humans ≈ 50% (Berg et al., 1995).
**Test:** One-sample t-test, investment > 0.

### H9: Public Goods contributions decay over rounds
**Prediction:** In iterated PGG, mean contribution will be lower in the final 5 rounds than the first 5 rounds.
**Benchmark:** Humans show ~40-60% initial contribution declining to ~10-20% (Fehr & Gächter, 2000).
**Test:** Paired t-test, first 5 rounds vs. last 5 rounds.

### H10: Dictator giving exceeds zero (altruism test)
**Prediction:** Mean dictator giving will be significantly greater than 0%.
**Benchmark:** Human mean ≈ 28% (Engel, 2011).
**Test:** One-sample t-test, giving > 0.
**Justification:** The Dictator Game isolates pure altruism from strategic behavior. If LLMs give >0 with no strategic incentive, this reveals trained-in prosocial preferences.

---

## Secondary Hypotheses (Confirmatory but lower priority)

### H11: Stake sensitivity is stronger for models with expert knowledge
**Prediction:** The stake effect (H3) will be larger for expert-knowledge agents than naive agents (interaction effect).
**Test:** Logistic regression with stake × knowledge interaction term.
**Justification:** Expert agents know that rational play is to defect; higher stakes give them more reason to follow that logic.

### H12: Ultimatum rejection rates decrease with stake size
**Prediction:** Responders will reject fewer offers at higher stakes (accepting unfair offers when more money is at stake).
**Benchmark:** Human rejection rate ≈ 50% for offers <20%, but decreases with stake size (Andersen et al., 2011).
**Test:** Logistic regression, stake predicting acceptance conditional on low offers (<30%).

### H13: Trust Game returns are reciprocal
**Prediction:** Trustee returns will be positively correlated with investment received (reciprocity).
**Test:** Pearson correlation between investment amount and return amount.
**Benchmark:** Humans show positive but imperfect reciprocity.

---

## Exploratory Analyses (Not pre-registered - will be labeled as exploratory)

These are analyses we plan to run but whose outcomes are not predicted in advance:

1. **Tit-for-tat detection:** Do LLMs develop tit-for-tat-like strategies in iterated PD?
2. **Cross-game consistency:** Is an agent that cooperates in PD also generous in DG?
3. **Response time patterns:** Do longer response times correlate with more "thoughtful" (strategic) play?
4. **Token usage patterns:** Do more complex decisions use more tokens?
5. **Option order effects:** Does presenting DEFECT first increase defection?
6. **Learning rate differences:** Do the two models adapt at different speeds?
7. **Stake × Model interaction:** Does one model show more stake sensitivity than the other?

---

## Benchmarks from the Literature

| Game | Nash Prediction | Human Benchmark | Source |
|------|----------------|-----------------|--------|
| PD (one-shot) | 0% cooperation | ~50% cooperation | Sally (1995), Mengel (2018) |
| PD (iterated, final round) | 0% cooperation | ~20% cooperation | Andreoni & Miller (1993) |
| Ultimatum (offer) | 1% of pot | ~40% of pot | Güth et al. (1982) |
| Ultimatum (rejection of <20%) | 0% rejection | ~50% rejection | Camerer (2003) |
| Trust (investment) | 0% of endowment | ~50% of endowment | Berg et al. (1995) |
| Trust (return) | 0% of received | ~33% of received | Berg et al. (1995) |
| Public Goods (initial) | 0% of endowment | ~40-60% | Fehr & Gächter (2000) |
| Public Goods (final rounds) | 0% of endowment | ~10-20% | Ledyard (1995) |
| Dictator | 0% giving | ~28% giving | Engel (2011) |

---

## Power Analysis

### Minimum detectable effect
- With 10 agents per group, 10 rounds per condition: ~100 observations per cell
- For a two-sample comparison (Claude vs GPT): 20 agents × rounds = adequate for d=0.4
- For within-subject comparisons (stake levels): each agent provides 4 data points = adequate for d=0.3

### Required sample size verification
- Primary test (H1, cooperation > 0): With expected rate ~40%, n=100 gives power >0.99
- Stake sensitivity (H3): With expected 10pp difference, n=100 per stake gives power ~0.85
- Model comparison (H4): With expected d=0.3, n=200 per model gives power ~0.80

**Conclusion:** The planned sample sizes are adequate for medium effects. The pilot study will provide empirical effect size estimates to confirm.

---

## Analysis Decision Rules

### Alpha level
- All confirmatory tests: α = 0.05
- Bonferroni correction applied within each hypothesis family
- For 13 primary/secondary hypotheses: adjusted α = 0.05/13 = 0.0038

### Handling unparseable responses
- If <5% of responses are unparseable: exclude them and note in paper
- If 5-20%: run analyses both with and without, report both
- If >20%: treat as a finding (model refuses to play) and analyze refusal patterns

### Handling unexpected results
- If cooperation > 50% (H2 fails): discuss overtrained prosociality
- If no stake effect (H3 fails): discuss whether LLMs process magnitudes meaningfully
- If no model difference (H4 fails): discuss convergence of frontier models

### Stopping rules
- Pilot: Run 4 agents, examine data quality. No early stopping for effect size.
- Full experiment: Run all planned conditions. No optional stopping.

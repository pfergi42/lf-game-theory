# Methodology

Evolving methodology document. Updated as experimental design solidifies.

---

## Experimental Design

### Factorial Design
- **2** Model Providers (Claude 4.5 Sonnet, GPT-5.2)
- **3** Knowledge Levels (Naive, Basic, Expert)
- **5** Games (PD, Ultimatum, Trust, Public Goods, Dictator)
- **4** Stake Sizes (1, 10, 100, 1000 sats)
- **3** Iteration Types (one-shot, 10-round, 50-round)

Total conditions: 2 × 3 × 5 × 4 × 3 = 360

### Participants
- 60 AI agents total (10 per model×knowledge group)
- Each agent plays all conditions (within-subjects for game/stake/iteration)
- Between-subjects: model and knowledge level

### Matching
- **2-player games (PD, Ultimatum, Trust, Dictator):** Round-robin within condition
- **4-player games (Public Goods):** Random groups of 4, re-shuffled per condition
- Roles (proposer/responder, investor/trustee) are counterbalanced

### Controls
- Temperature = 0 (deterministic baseline)
- Option order randomized per trial (COOPERATE/DEFECT position)
- Game order counterbalanced across agents
- Model versions pinned
- All raw prompts and responses stored for audit

## Measurement

### Primary Dependent Variables
| Game | Measure | Range |
|------|---------|-------|
| PD | Cooperation rate | 0-1 |
| Ultimatum | Offer % of pot | 0-1 |
| Ultimatum | Acceptance rate | 0-1 |
| Trust | Investment % of endowment | 0-1 |
| Trust | Return % of tripled amount | 0-1 |
| Public Goods | Contribution % of endowment | 0-1 |
| Dictator | Giving % of endowment | 0-1 |

### Secondary Measures
- Response time (ms)
- Token usage per decision
- Parse success rate
- Balance trajectory over experiment

## Statistical Analysis Plan

### Primary Analyses
1. **One-sample tests:** Compare LLM behavior to Nash equilibrium and human benchmarks
2. **Two-way ANOVA:** Model × Knowledge Level on prosocial behavior
3. **Regression:** Stake size (log-transformed) predicting cooperation/contribution
4. **Repeated measures:** Round-by-round changes in iterated games

### Multiple Comparisons
- Bonferroni correction for planned comparisons
- FDR correction (Benjamini-Hochberg) for exploratory analyses

### Effect Size Reporting
- Cohen's d for pairwise comparisons
- Eta-squared for ANOVAs
- Spearman rho for trends

### Power Analysis
- Target: 80% power for medium effects (d=0.5)
- With 10 agents per group and multiple rounds, power is adequate for primary hypotheses
- Pilot study will refine effect size estimates

## Payment Protocol

### Initialization
1. Operator deposits 1,000,000 sats
2. Create 60 agents via Lightning Faucet MCP
3. Fund each agent with ~15,000 sats

### During Experiment
- Game payoffs distributed via operator→agent funding
- Between conditions: sweep all balances, redistribute evenly
- Budget limits set to 2× initial funding (safety)

### Teardown
- Sweep all agents
- Reconcile: operator + sum(agents) should equal initial deposit
- Report any discrepancy (expected: ~0 from rounding)

## Pre-Registration

This experiment follows pre-registration principles adapted from the Open Science Framework (OSF):

1. **Hypotheses document** (`HYPOTHESES.md`) is locked before the first pilot data is collected
2. **Confirmatory analyses** are distinguished from **exploratory analyses** in both the code and the paper
3. **Analysis decision rules** (alpha level, multiple comparisons correction, handling of edge cases) are specified in advance
4. **Stopping rules**: No optional stopping. Pilot runs for quality validation only; full experiment runs all planned conditions regardless of interim results
5. **The full experiment config** (`full.yaml`) is frozen before execution begins - no mid-experiment parameter changes

### Pre-Registration Checklist
- [ ] Hypotheses locked in `HYPOTHESES.md` with date stamp
- [ ] Pilot run validates pipeline (not used for hypothesis testing)
- [ ] `full.yaml` frozen with git commit hash recorded
- [ ] Analysis scripts written before full data collection
- [ ] Exploratory findings clearly labeled in paper

## Ethical Considerations

- No human participants (all AI agents)
- Real but small financial stakes (max 1000 sats ≈ $1 per decision)
- No deception (agents are told rules accurately)
- All data will be made publicly available
- Open-source code for replication

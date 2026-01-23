# Research Log

Append-only log of all sessions, decisions, and findings.

---

## 2026-01-22 - Session 001: Project Initialization

**Phase:** Infrastructure (Phase 1)

**Accomplished:**
- Created full project structure (TypeScript + Python analysis)
- Implemented SQLite data store with schema for experiments, agents, sessions, decisions, payments
- Built Agent Manager wrapping Lightning Faucet API for agent lifecycle
- Built LLM Router supporting Claude (Anthropic SDK) and OpenAI
- Implemented prompt templates for all 5 games x 3 knowledge levels
- Built response parser with retry logic for unparseable responses
- Implemented all 5 game engines: PD, Ultimatum, Trust, Public Goods, Dictator
- Created Coordinator for full experiment orchestration
- Created pilot.yaml (4 agents, PD only) and full.yaml (60 agents, all games)
- Built Python analysis pipeline: descriptive stats, inference tests, publication figures

**Key Decisions:**
- Using `better-sqlite3` for data store (fast, single-file, no server needed)
- Temperature=0 for all LLM calls (reproducibility)
- Agent Manager uses HTTP calls to Lightning Faucet API (not MCP tools directly)
- Closed-loop payment system: operator funds agents, sweeps back between conditions
- Randomized option order for PD to control for position bias
- 6 key figures planned matching standard behavioral economics publications

**Next Steps:**
- Install dependencies and verify TypeScript compilation ✓
- Run pilot study with 4 agents
- Validate payment flows and prompt formatting
- Estimate effect sizes for power analysis

---

## 2026-01-22 - Session 001b: Scientific Rigor Pass

**Phase:** Pre-Registration & Hypothesis Development

**Accomplished:**
- Created HYPOTHESES.md with 13 formal pre-registered hypotheses
- Added specific directional predictions with quantitative benchmarks from the literature
- Separated confirmatory (pre-registered) from exploratory (post-hoc) analyses
- Added power analysis showing sample sizes are adequate for medium effects
- Specified analysis decision rules (alpha, corrections, stopping rules, handling edge cases)
- Added pre-registration section to METHODOLOGY.md
- Added formal Hypotheses section to paper (main.tex) with predictions table
- Added 8 additional literature references for benchmarks
- Recorded decisions D008-D010 (pre-registration, Bonferroni, pilot separation)
- Verified TypeScript compiles cleanly (16 files, 0 errors)
- Built dist/ successfully

**Key Decisions:**
- Pre-registration approach with hypotheses locked before data collection
- Bonferroni correction (α = 0.0038) for confirmatory tests
- Pilot study used ONLY for pipeline validation, not hypothesis testing
- Exploratory analyses explicitly labeled as such

**Next Steps:**
- Lock HYPOTHESES.md with date stamp before pilot
- Run pilot study
- Validate end-to-end pipeline
- Freeze full.yaml config before main experiment

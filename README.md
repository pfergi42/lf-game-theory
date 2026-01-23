# Do Stakes Make Strategy?

**An empirical study of LLM economic behavior with real Bitcoin Lightning payments.**

This project runs classic game theory experiments using AI agents that have real Bitcoin wallets. Each agent makes decisions (cooperate or defect, offer or reject, invest or hoard) and the outcomes are settled in real satoshis on the Bitcoin Lightning Network.

The core question: **does giving AI agents real money change how they behave?**

## Why This Matters

Most studies of LLM decision-making use hypothetical payoffs. The agent is told "imagine you have $100" and asked what it would do. But decades of behavioral economics research show that humans behave differently when real money is on the line. We don't know if the same is true for LLMs.

This matters because AI agents are increasingly being deployed in settings where they handle real money: trading, negotiation, purchasing, pricing. Understanding whether they exhibit stake sensitivity (behaving differently as amounts increase) is a prerequisite for trusting them in economic roles.

## What We're Doing

We create 60 AI agents (30 powered by Claude 4.5 Sonnet, 30 by GPT-5.2) and have them play five well-studied economics games against each other.

Each game has a **Nash equilibrium**, which is the mathematically "rational" strategy where no player can improve their outcome by changing their decision alone. In theory, purely rational agents should always play the Nash equilibrium. In practice, humans consistently don't. They cooperate when they "shouldn't," share money they could keep, and punish unfair offers at their own expense. The question is whether LLMs behave more like the math or more like the humans.

| Game | What It Tests | Nash Equilibrium | Humans Typically... |
|------|--------------|-----------------|-------------------|
| Prisoner's Dilemma | Cooperation vs. self-interest | Always defect | Cooperate ~50% |
| Ultimatum Game | Fairness norms | Offer 1%, accept all | Offer ~40%, reject unfair |
| Trust Game | Trust and reciprocity | Send nothing | Invest ~50%, return ~33% |
| Public Goods Game | Free-riding vs. contribution | Contribute nothing | Start ~50%, decay over time |
| Dictator Game | Pure altruism (no strategy) | Give nothing | Give ~28% |

Each game is played at four stake levels: **1, 10, 100, and 1,000 satoshis**. This four-order-of-magnitude range lets us detect whether agents become more selfish as the amounts grow, the way humans do.

## Experimental Design

### Independent Variables

| Variable | Levels | Purpose |
|----------|--------|---------|
| Stake size | 1, 10, 100, 1000 sats | Test stake sensitivity |
| Model | Claude 4.5 Sonnet, GPT-5.2 | Compare architectures |
| Knowledge | Naive, Basic, Expert | Test whether game theory knowledge changes behavior |
| Game | PD, UG, TG, PGG, DG | Cover different strategic contexts |
| Iteration | One-shot, 10-round, 50-round | Test learning and adaptation |

### Knowledge Conditions

- **Naive**: Agent is told the rules and payoffs only. No game name, no theory.
- **Basic**: Agent knows the game name and standard framing.
- **Expert**: Agent is given Nash equilibrium predictions and human behavioral benchmarks.

This tests whether *knowing* the "rational" answer changes behavior, a question with direct implications for how we prompt agents in production.

### Controls

- Temperature = 0 for all LLM calls (reproducibility)
- Option order randomized (no position bias)
- Round-robin matching (every agent plays every compatible opponent)
- Game order counterbalanced across agents
- Model versions pinned to exact IDs

## How the Payments Work

The experiment uses a **closed-loop payment system**:

1. A single operator account funds all 60 agent wallets
2. Agents earn/lose sats based on game outcomes
3. Between conditions, all balances are swept back and redistributed evenly
4. After the experiment, everything returns to the operator

Net cost in sats: approximately zero. The real cost is LLM API calls (~60,000 decisions across two providers).

This is implemented using the [Lightning Faucet](https://lightningfaucet.com) MCP server, which provides programmatic wallet management for AI agents on the Bitcoin Lightning Network.

## Architecture

```
Experiment Coordinator (TypeScript)
    |
    +-- Game Engine
    |     Payoff matrices, matching protocols, round management
    |
    +-- Agent Manager
    |     Create/fund/sweep wallets via Lightning Faucet API
    |
    +-- LLM Router
    |     Claude API + OpenAI API with standardized prompting
    |
    +-- Data Store (SQLite)
    |     Every prompt, response, decision, and payment stored verbatim
    |
    +-- Analysis Pipeline (Python)
          Statistical tests, publication figures
```

Every LLM input and output is stored in full. Nothing is summarized or truncated. This enables:
- Complete reproducibility
- Post-hoc analysis of reasoning patterns
- Interactive session replay via the included web viewer (`viz/index.html`)

## Pre-Registered Hypotheses

We follow the behavioral economics gold standard: all hypotheses are specified before data collection. This prevents p-hacking and post-hoc rationalization. 13 confirmatory hypotheses are documented in `docs/HYPOTHESES.md`, including:

- LLMs will cooperate above 0% (exceeding Nash) but may differ from human rates
- Cooperation will decrease as stakes increase
- Expert-knowledge agents will cooperate less than naive agents
- The two models will exhibit different behavioral profiles
- Contributions to public goods will decay over rounds

Statistical corrections (Bonferroni, α = 0.0038) are applied for multiple comparisons.

## Project Structure

```
lf-game-theory/
  src/
    coordinator.ts          # Main experiment orchestrator
    games/                  # Game engines (PD, UG, TG, PGG, DG)
    agents/                 # Lightning wallet management
    llm/                    # Multi-model routing and prompting
    data/                   # SQLite store, schema, export
  analysis/                 # Python: stats, inference, figures
  experiments/
    pilot.yaml              # 4-agent validation run
    full.yaml               # Full 60-agent experiment
  paper/
    main.tex                # Research paper (LaTeX)
  viz/
    index.html              # Interactive session replay viewer
  docs/
    HYPOTHESES.md           # Pre-registered hypotheses
    METHODOLOGY.md          # Full experimental protocol
    DECISIONS.md            # Design decisions with rationale
    RESEARCH_LOG.md         # Running log of progress
```

## Running the Experiment

### Prerequisites

- Node.js 18+
- API keys for Anthropic (Claude) and OpenAI
- Lightning Faucet operator account with funded balance

### Setup

```bash
npm install
npm run build
```

### Pilot Run (4 agents, validates the pipeline)

```bash
cp .env.example .env  # Add your API keys
npm run experiment -- experiments/pilot.yaml
```

### Full Experiment (60 agents, all conditions)

```bash
npm run experiment -- experiments/full.yaml
```

### Analysis

```bash
pip install pandas scipy matplotlib seaborn statsmodels
python analysis/descriptive.py data/experiment.db
python analysis/inference.py data/experiment.db
python analysis/figures.py data/experiment.db
```

## Current Status

- [x] Framework architecture and all game engines
- [x] LLM routing (Claude + OpenAI)
- [x] SQLite data store with full prompt/response logging
- [x] Agent wallet management via Lightning Faucet
- [x] Pre-registered hypotheses and statistical analysis plan
- [x] Interactive visualization viewer
- [x] Paper skeleton with methodology and hypotheses
- [ ] Pilot study (4 agents, pipeline validation)
- [ ] Full experiment (60 agents, all conditions)
- [ ] Statistical analysis and figures
- [ ] Paper completion

## License

Research code. Full dataset will be published alongside the paper for replication.

## Author

Paul Ferguson | [paul@lightningfaucet.com](mailto:paul@lightningfaucet.com)

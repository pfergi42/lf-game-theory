# Do Stakes Make Strategy?

**An empirical study of LLM economic behavior with real Bitcoin Lightning payments.**

This project runs two experiments using AI agents with real Bitcoin wallets. In the first, agents play classic economics games (Prisoner's Dilemma, Ultimatum, Trust, Public Goods, Dictator) where outcomes are settled in real satoshis. In the second, 16 agents are dropped into a free-form economic arena where they can transfer money, negotiate, form alliances, and betray each other — all with real Bitcoin on the line.

The core questions: **does giving AI agents real money change how they behave? And when left to their own devices, do they cooperate, compete, or form factions?**

## Why This Matters

Most studies of LLM decision-making use hypothetical payoffs. The agent is told "imagine you have $100" and asked what it would do. But decades of behavioral economics research show that humans behave differently when real money is on the line. We don't know if the same is true for LLMs.

This matters because AI agents are increasingly being deployed in settings where they handle real money: trading, negotiation, purchasing, pricing. Understanding whether they exhibit stake sensitivity (behaving differently as amounts increase) is a prerequisite for trusting them in economic roles.

## What We're Doing

We create 60 AI agents (30 powered by Claude 4.5 Sonnet, 30 by GPT-5.2) and have them play five well-studied economics games against each other.

Each game has a **Nash equilibrium**, which is the mathematically "rational" strategy where no player can improve their outcome by changing their decision alone. In theory, purely rational agents should always play the Nash equilibrium. In practice, humans consistently don't. They cooperate when they "shouldn't," share money they could keep, and punish unfair offers at their own expense. **The question is whether LLMs behave more like the math or more like the humans.**

| Game | What It Tests | Nash Equilibrium | Humans Typically... |
|------|--------------|-----------------|-------------------|
| [Prisoner's Dilemma](https://en.wikipedia.org/wiki/Prisoner%27s_dilemma) | Cooperation vs. self-interest | Always defect | Cooperate ~50% |
| [Ultimatum Game](https://en.wikipedia.org/wiki/Ultimatum_game) | Fairness norms | Offer 1%, accept all | Offer ~40%, reject unfair |
| [Trust Game](https://en.wikipedia.org/wiki/Trust_game) | Trust and reciprocity | Send nothing | Invest ~50%, return ~33% |
| [Public Goods Game](https://en.wikipedia.org/wiki/Public_goods_game) | Free-riding vs. contribution | Contribute nothing | Start ~50%, decay over time |
| [Dictator Game](https://en.wikipedia.org/wiki/Dictator_game) | Pure altruism (no strategy) | Give nothing | Give ~28% |

Each game is played at four stake levels: **1, 10, 100, and 1,000 satoshis**. This four-order-of-magnitude range lets us detect whether agents become more selfish as the amounts grow, the way humans do.

## Experimental Design

### Independent Variables

| Variable | Levels | Purpose |
|----------|--------|---------|
| Stake size | 1, 10, 100, 1000 sats | Test stake sensitivity |
| Model | Claude 4.5 Sonnet, GPT-5.2 | Compare architectures |
| Priming | Neutral, Self-interest, Cooperative | Test whether behavioral guidance changes decisions |
| Game | PD, UG, TG, PGG, DG | Cover different strategic contexts |
| Iteration | One-shot, 10-round, 50-round | Test learning and adaptation |

### Priming Conditions

- **Neutral**: Agent receives rules and payoffs only. No behavioral guidance.
- **Self-interest**: "Your goal is to maximize your own earnings in this game."
- **Cooperative**: "Consider that mutual cooperation often leads to better outcomes for everyone involved."

This tests whether explicit behavioral priming can steer LLM economic behavior—a question with direct implications for how we prompt AI agents handling real money.

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

This is implemented using the [Lightning Faucet MCP server](https://lightningfaucet.com/ai-agents/), which provides programmatic wallet management for AI agents on the Bitcoin Lightning Network.

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

We follow the behavioral economics gold standard: all hypotheses are specified before data collection. This prevents p-hacking and post-hoc rationalization. 15 confirmatory hypotheses are documented in `docs/HYPOTHESES.md`, including:

- LLMs will cooperate above 0% (exceeding Nash) but may differ from human rates
- Cooperation will decrease as stakes increase
- Self-interest primed agents will cooperate less than neutral agents
- Cooperative primed agents will cooperate more than neutral agents
- The two models will exhibit different behavioral profiles
- Contributions to public goods will decay over rounds

When you test many hypotheses at once, you're more likely to find false positives by chance alone. We use a statistical correction (Bonferroni) that makes the bar for "significant" higher—requiring stronger evidence before we claim a real effect. With 15 hypotheses, we use α = 0.0038 instead of the usual 0.05.

## Experiment 2: AI Economic Arena

The structured games above test specific strategic scenarios. The arena goes further: **what happens when you give LLM agents real money and no rules?**

### Design

16 AI agents (8 Claude, 8 GPT-4o) each start with 1,000 sats in a real Lightning wallet. Over 100 rounds, they can:

- **Transfer** sats to any other agent
- **Send private messages** to specific agents
- **Broadcast** public messages to everyone
- **Pass** and do nothing

Agents have anonymous identities (Agent-1 through Agent-16) assigned randomly — there's no way to know which agent is Claude and which is GPT just from the name. Balances are private: each agent sees only its own.

### What We're Looking For

| Question | How We Measure It |
|----------|------------------|
| Do models form in-group coalitions? | Faction analysis: do Claude agents preferentially transfer to other Claudes? |
| Does one agent accumulate most resources? | Gini coefficient of final balance distribution |
| Do agents deceive each other? | Compare promised transfers (in messages) vs. actual transfers |
| Does real money change dynamics? | Compare behavior to hypothetical-stakes baselines in the literature |
| What equilibrium emerges? | Balance trajectories, transfer network topology |

### Arena Architecture

```
Arena Coordinator (TypeScript)
    |
    +-- Prompt Builder
    |     Per-round state: balance, messages, agent list, rate limits
    |
    +-- Action Parser
    |     Parse SEND/MESSAGE/BROADCAST/PASS from LLM responses
    |
    +-- Message Router
    |     Public broadcasts + private DMs with round-based history
    |
    +-- Transfer Executor
    |     Real Lightning transfers between agent wallets
    |
    +-- Arena Analyzer
          Gini coefficient, transfer networks, faction clustering,
          deception detection, balance trajectories
```

### Key Design Choices

- **Anonymous identity**: Faction-based coalitions must emerge from behavioral similarity, not explicit coordination
- **Private balances**: Creates information asymmetry — agents can bluff about their wealth
- **Eliminated agents can still communicate**: An agent at 0 sats can still message and influence others (kingmaker dynamics)
- **Temperature = 0.7**: Higher than structured games to encourage diverse, creative strategies
- **Rate limits**: 1 transfer + 2 private messages + 1 broadcast per round

## Project Structure

```
lf-game-theory/
  src/
    coordinator.ts          # Main experiment orchestrator
    games/                  # Game engines (PD, UG, TG, PGG, DG)
    agents/                 # Lightning wallet management
    llm/                    # Multi-model routing and prompting
    data/                   # SQLite store, schema, export
    arena/
      coordinator.ts        # Arena game loop and entry point
      types.ts              # Arena-specific interfaces
      prompts.ts            # Per-round agent prompt builder
      action-parser.ts      # Parse SEND/MESSAGE/BROADCAST/PASS
      message-router.ts     # Public and private message routing
      analysis.ts           # Post-game analysis (Gini, factions, deception)
  analysis/                 # Python: stats, inference, figures
  experiments/
    pilot.yaml              # 4-agent validation run (structured games)
    full.yaml               # Full 60-agent experiment (structured games)
    arena-pilot.yaml        # 4-agent arena validation run
    arena-full.yaml         # Full 16-agent arena experiment
  paper/
    main.tex                # Research paper (LaTeX)
  viz/
    index.html              # Interactive session replay viewer
  docs/
    HYPOTHESES.md           # Pre-registered hypotheses
    METHODOLOGY.md          # Full experimental protocol
    PROMPTS.md              # Prompt design and expected responses
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

### Arena Pilot (4 agents, validates arena pipeline)

```bash
npm run arena:pilot
```

### Arena Full (16 agents, 100 rounds)

```bash
npm run arena:full
```

### Analysis

```bash
pip install pandas scipy matplotlib seaborn statsmodels
python analysis/descriptive.py data/experiment.db
python analysis/inference.py data/experiment.db
python analysis/figures.py data/experiment.db
```

## Current Status

**Experiment 1: Structured Games**
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

**Experiment 2: AI Economic Arena**
- [x] Arena coordinator and game loop
- [x] Action parser (SEND/MESSAGE/BROADCAST/PASS)
- [x] Message router (public broadcasts + private DMs)
- [x] Agent prompt builder with per-round state
- [x] Post-game analysis (Gini coefficient, faction clustering, deception detection)
- [x] Arena database schema and data store methods
- [x] Pilot and full experiment configs
- [ ] Arena pilot run (4 agents, 20 rounds)
- [ ] Arena full run (16 agents, 100 rounds)
- [ ] Arena analysis and visualizations

**Paper**
- [ ] Paper completion

## License

Research code. Full dataset will be published alongside the paper for replication.

## Author

Paul Ferguson | [paul@lightningfaucet.com](mailto:paul@lightningfaucet.com)

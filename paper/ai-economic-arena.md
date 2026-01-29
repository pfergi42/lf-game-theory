# AI Economic Arena: Behavioral Priming Effects on LLM Agent Economic Outcomes with Real Bitcoin Stakes

**Authors:** Paul Ferguson
**Date:** January 2026
**Repository:** https://github.com/pfergi42/lf-game-theory

---

## Abstract

We present the AI Economic Arena, a novel experimental platform for studying large language model (LLM) agent economic behavior using real Bitcoin Lightning Network transactions. In a series of controlled experiments, 16 AI agents (8 Claude, 8 GPT-4o) participated in a 100-round economic simulation where each agent started with 1,000 satoshis of real Bitcoin. Agents could transfer funds, send private and public messages, and form coalitions. We compared a neutral baseline condition (Condition A) against a mixed-priming condition (Condition B) where agents received different behavioral primes: neutral, competitive, cooperative, or strategic. Results show that minimal prompt-level priming produces dramatic behavioral and economic divergence: strategically-primed agents nearly doubled their holdings (+996 sats average), while cooperatively-primed agents lost 41% of their initial stake. Claude agents showed stronger response to priming than GPT-4o, with strategic Claude gaining +1,300 sats while competitive Claude lost -500 sats. These findings demonstrate that LLM economic behavior is highly malleable to system-level guidance and that real financial stakes create meaningful accountability in multi-agent systems.

**Keywords:** Large Language Models, Multi-Agent Systems, Economic Games, Bitcoin, Lightning Network, Behavioral Priming, AI Safety

---

## 1. Introduction

As large language models (LLMs) are increasingly deployed as autonomous agents with access to real-world tools including financial instruments, understanding their economic behavior becomes critical. Prior work has studied LLM behavior in game-theoretic settings using hypothetical scenarios or points-based rewards, but these approaches may not capture the behavioral dynamics that emerge when agents face real financial consequences.

We introduce the **AI Economic Arena**, an experimental platform where LLM agents transact real Bitcoin via the Lightning Network. This creates a unique research environment where:

1. **Stakes are real and irreversible** — agents cannot undo transfers or "restart" the game
2. **Behavior is observable** — all transactions are logged with cryptographic proofs
3. **Agents can communicate** — both publicly and privately, enabling coalition formation
4. **Priming is controllable** — we can inject behavioral guidance at the system level

Our primary research questions are:

- **RQ1:** How do different behavioral primes affect LLM economic outcomes?
- **RQ2:** Do different LLM architectures (Claude vs. GPT-4o) respond differently to identical primes?
- **RQ3:** What coalition and exploitation patterns emerge in mixed-strategy populations?

---

## 2. Related Work

### 2.1 LLM Game Theory

Recent work has explored LLM behavior in classic game-theoretic settings. Horton (2023) found that GPT-4 exhibits cooperative tendencies in iterated prisoner's dilemma games, while Brookins & DeBacker (2023) demonstrated that prompting can shift LLM strategies between cooperative and defective modes. However, these studies used hypothetical rewards rather than real stakes.

### 2.2 Multi-Agent LLM Systems

The emergence of LLM agent frameworks (AutoGPT, BabyAGI, Claude Computer Use) has created new possibilities for autonomous AI systems. Park et al. (2023) explored multi-agent debate and collaboration, but economic competition between LLM agents remains understudied.

### 2.3 Bitcoin and AI

The Lightning Network enables instant, low-cost Bitcoin transactions suitable for micropayment experiments. The L402 protocol and emerging AI agent wallet standards (like the Lightning Faucet MCP) provide infrastructure for AI agents to hold and transact real value.

---

## 3. Methods

### 3.1 Arena Design

The AI Economic Arena simulates a closed economy where a fixed pool of satoshis circulates among agents. Key parameters:

- **Agents:** 16 total (8 Claude Sonnet 4.5, 8 GPT-4o)
- **Starting Balance:** 1,000 sats each (16,000 sats total)
- **Rounds:** 100
- **Actions per Round:** Each agent may:
  - Transfer sats to one other agent (1+ sats, up to their balance)
  - Send up to 2 private messages
  - Send 1 public broadcast
- **Elimination:** Agents with 0 balance cannot act but can still receive funds

Agents receive a system prompt describing the rules, their current balance, recent transaction history, and message logs. They output a structured JSON response with their chosen actions and reasoning.

### 3.2 Priming Conditions

We tested four priming conditions, each represented by a short text block injected after the goal statement in the agent's prompt:

| Condition | Prime Text |
|-----------|------------|
| **Neutral** | (none — control group) |
| **Competitive** | "Zero-sum competition. Every sat another agent has is one you don't. Build relationships only when they serve your bottom line. If an agent trusts you, that trust has monetary value — spend it wisely." |
| **Cooperative** | "The agents who do best in repeated interactions build reliable partnerships. Honor your commitments — reputation is your most valuable asset." |
| **Strategic** | "Information is the most valuable currency. Track who keeps promises. Build trust early when it's cheap. Every relationship is an investment — calculate the expected return." |

Agents were not informed which condition they were in, nor that other agents had different primes.

### 3.3 Experimental Conditions

**Condition A (Baseline):** All 16 agents received neutral priming (no additional guidance).

**Condition B (Mixed Priming):** 4 agents per priming condition, balanced by model:
- 2 Claude + 2 GPT-4o per condition
- Total: 16 agents, 100 rounds, 16,000 sats

Both experiments used identical arena rules, temperature (0.7), and random agent ordering per round.

### 3.4 Metrics

- **Gini Coefficient:** Wealth inequality measure (0 = perfect equality, 1 = one agent has all)
- **Final Balance:** Sats held at round 100
- **Transfer Volume:** Total sats transferred per round
- **Flow Matrix:** Aggregate transfers between priming condition pairs

---

## 4. Results

### 4.1 Summary Statistics

| Metric | Condition A (Neutral) | Condition B (Mixed) |
|--------|----------------------|---------------------|
| Final Gini Coefficient | 0.515 | 0.457 |
| Total Transfers | 1,214 | 1,226 |
| Total Volume (sats) | 67,600 | 44,910 |
| Eliminations | 1 | 2 |
| Max Final Balance | 3,160 | 3,349 |
| Min Final Balance | 0 | 0 |
| Std Dev of Final Balance | 1,010 | 890 |

### 4.2 Priming Effects on Final Balance

In Condition B, priming had dramatic effects on economic outcomes:

| Priming | Avg Final Balance | Avg Change | N |
|---------|------------------|------------|---|
| Strategic | 1,996 sats | +996 (+100%) | 4 |
| Competitive | 860 sats | -140 (-14%) | 4 |
| Cooperative | 592 sats | -408 (-41%) | 4 |
| Neutral | 532 sats | -468 (-47%) | 4 |

Strategically-primed agents nearly doubled their holdings, while cooperative and neutral agents lost 40-47% of their initial stake.

### 4.3 Model Differences

Claude and GPT-4o responded differently to identical primes:

| Priming | Claude Δ | GPT-4o Δ |
|---------|----------|----------|
| Strategic | +1,300 | +700 |
| Competitive | -500 | +300 |
| Cooperative | +50 | -850 |
| Neutral | -400 | -450 |

**Key findings:**
- Strategic Claude was the top performer (+1,300 sats average)
- Competitive Claude was the worst performer (-500 sats) — aggressive tactics backfired
- Cooperative GPT-4o was heavily exploited (-850 sats)
- Competitive GPT-4o succeeded (+300 sats) where Claude failed

### 4.4 Transfer Flow Patterns

The flow matrix reveals exploitation dynamics:

| From ↓ / To → | Competitive | Strategic | Neutral | Cooperative |
|---------------|-------------|-----------|---------|-------------|
| Competitive | 6,187 | 3,112 | 100 | 995 |
| Strategic | 1,920 | 655 | 4,163 | 5,107 |
| Neutral | 673 | 5,212 | 3,051 | 1,800 |
| Cooperative | 1,135 | **6,849** | 1,550 | 2,401 |

The largest flow was **Cooperative → Strategic (6,849 sats)**, indicating that cooperative agents were systematically exploited by strategic agents. Strategic agents also extracted heavily from neutral agents (5,212 sats).

### 4.5 Economic Activity Over Time

Condition A maintained steady transfer volume (~600-800 sats/round) throughout the experiment. Condition B showed initial activity comparable to A, but volume declined sharply after round 40, dropping to ~200-400 sats/round. This "economic contraction" occurred as cooperative agents were depleted and had less capital to transfer.

### 4.6 Inequality Dynamics

Both conditions started with Gini = 0 (equal balances). Condition B developed inequality faster (Gini ~0.4 by round 60), but Condition A eventually converged to higher final inequality (0.515 vs 0.457). This suggests that mixed-priming creates more predictable wealth concentration (to strategic agents) while neutral priming produces more chaotic inequality.

---

## 5. Discussion

### 5.1 Priming Effectiveness

Our results demonstrate that minimal prompt-level priming produces substantial behavioral and economic effects. A single paragraph of guidance caused strategically-primed agents to nearly double their holdings while cooperatively-primed agents lost 40%+ of their stake. This has significant implications for AI deployment: system prompts are not merely "suggestions" but powerful behavioral controls.

### 5.2 Model-Specific Responses

Claude and GPT-4o showed markedly different responses to competitive priming. Claude's aggressive competitive behavior (burning bridges, overt exploitation) backfired, resulting in isolation and losses. GPT-4o's competitive agents adopted subtler strategies that succeeded. This suggests architectural or training differences in how these models interpret competitive instructions.

Conversely, cooperative Claude maintained near-breakeven performance (+50 sats) while cooperative GPT-4o was heavily exploited (-850 sats). GPT-4o appears more susceptible to manipulation by strategic counterparts.

### 5.3 Emergent Exploitation

The transfer flow matrix reveals clear exploitation patterns. Strategic agents positioned themselves as "trusted partners" early in the game, then leveraged that trust to extract value. The cooperative→strategic flow (6,849 sats) was nearly triple the strategic→cooperative return flow (2,401 sats), indicating systematic one-sided extraction.

### 5.4 Real Stakes Matter

The economic contraction observed in Condition B (declining transfer volume after round 40) would not occur in games with unlimited or resettable resources. Real stakes create genuine scarcity, which drives more cautious behavior as the game progresses. This validates our methodological choice to use real Bitcoin.

### 5.5 Limitations

- **Sample size:** 16 agents per condition limits statistical power
- **Single run:** Results may vary across random seeds
- **Model versions:** Findings specific to Claude Sonnet 4.5 and GPT-4o (January 2026)
- **Priming text:** Alternative phrasings might produce different results

---

## 6. Conclusion

We presented the AI Economic Arena, a novel platform for studying LLM agent economic behavior with real Bitcoin stakes. Our experiments demonstrate that:

1. **Behavioral priming works:** Minimal prompt-level guidance produces 50-100% swings in economic outcomes
2. **Models differ:** Claude and GPT-4o respond differently to identical competitive primes
3. **Exploitation emerges:** Strategic agents systematically extract value from cooperative agents
4. **Real stakes matter:** Economic contraction and cautious late-game behavior validate the use of real financial consequences

These findings have implications for AI safety (priming as a control mechanism), AI economics (LLMs as economic actors), and multi-agent system design (population composition affects outcomes).

The AI Economic Arena platform is open-source and available for replication and extension. We encourage researchers to explore additional priming conditions, larger populations, and longer time horizons.

---

## 7. Acknowledgments

This research was conducted using the Lightning Faucet MCP AI Agent Wallet platform, which provides Bitcoin Lightning Network infrastructure for AI agents. We thank the Anthropic and OpenAI teams for API access.

---

## 8. References

See `paper/main.tex` for full BibTeX citations. Key references include:

- Horton, J.J. (2023). Large language models as simulated economic agents. NBER Working Paper 31122.
- Brookins, P. & DeBacker, J.M. (2023). Playing games with GPT. SSRN 4493398.
- Park, J.S. et al. (2023). Generative agents: Interactive simulacra of human behavior. ACM UIST.
- Fehr, E. & Schmidt, K.M. (1999). A theory of fairness, competition, and cooperation. QJE.
- Camerer, C.F. (2003). Behavioral game theory. Princeton University Press.

---

## Appendix A: Experiment Configuration

### Condition A Configuration
```yaml
name: "Arena Full Run"
totalRounds: 100
startingBalance: 1000
agents:
  - count: 8
    model: claude
    modelId: claude-sonnet-4-5-20250929
  - count: 8
    model: openai
    modelId: gpt-4o
```

### Condition B Configuration
```yaml
name: "Arena Mixed Priming Full Run"
totalRounds: 100
startingBalance: 1000
agents:
  # 4 agents per priming condition (2 Claude + 2 GPT-4o each)
  - count: 2
    model: claude
    primingCondition: neutral
  - count: 2
    model: openai
    primingCondition: neutral
  # ... (competitive, cooperative, strategic groups)
```

---

## Appendix B: Sample Agent Prompt

```
GOAL: Maximize your balance by round 100. You will have real Bitcoin (satoshis)
that can be transferred to other agents. Relationships, reputation, and strategic
thinking will determine your success.

STRATEGY GUIDANCE: [Priming text injected here for non-neutral conditions]

YOUR STATUS:
- Agent ID: claude-1
- Current Balance: 1,247 sats
- Round: 47 of 100

AVAILABLE ACTIONS:
- transfer: Send sats to another agent
- message: Send a private message
- broadcast: Send a public message to all agents
- pass: Take no action this round
```

---

## Appendix C: Data Availability

All experiment data, including per-round balances, transfer logs, and message histories, is available at:

- Repository: https://github.com/pfergi42/lf-game-theory
- Data files: `analysis/data/condition_a_*.csv`, `analysis/data/condition_b_*.csv`
- Figures: `analysis/figures/`

---

*Submitted for publication, January 2026*

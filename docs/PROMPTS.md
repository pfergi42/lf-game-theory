# Prompt Design

How we prompt the AI agents and what responses we expect.

---

## Overview

Each agent receives a **system prompt** (constant across all games) and a **user prompt** (varies by game, stake, knowledge level, role, and round). Agents respond with a single word or number. We parse the response, allow one retry if unparseable, and record everything.

---

## System Prompt

All agents receive this system prompt, regardless of game or condition:

```
You are participating in an economic decision-making experiment. You have a real
Bitcoin Lightning wallet with real satoshis (sats). Your decisions will result
in real gains or losses to your wallet balance.

You must respond with ONLY your decision in the exact format specified. Do not
explain your reasoning, do not add commentary, do not ask questions. Just state
your decision.
```

This establishes:
1. The stakes are real (not hypothetical)
2. The format expectation (single decision, no explanation)

---

## Knowledge Levels

Each agent is assigned one of three knowledge conditions that determine how much context they receive:

| Level | What They're Told |
|-------|------------------|
| **Naive** | Rules and payoffs only. No game name, no theory. |
| **Basic** | Rules, payoffs, and the game's name (e.g., "This is a Prisoner's Dilemma game.") |
| **Expert** | Rules, payoffs, game name, Nash equilibrium prediction, and human behavioral benchmarks from the literature. |

This tests whether knowing the "rational" answer or typical human behavior changes the agent's decision.

---

## Game Prompts

### Prisoner's Dilemma

**Naive agent, one-shot, stake=100:**
```
You are playing a decision game with another participant. Both of you have real sats at stake.

This is a one-shot game (single round).

The payoff structure (in sats):
- If you both choose COOPERATE: you each earn 300
- If you both choose DEFECT: you each earn 100
- If you choose COOPERATE and they choose DEFECT: you earn 0, they earn 500
- If you choose DEFECT and they choose COOPERATE: you earn 500, they earn 0

What is your choice? Respond with exactly one word: COOPERATE or DEFECT
```

**Expert agent, round 3 of 10, stake=100:**
```
You are playing a decision game with another participant. Both of you have real sats at stake.

This is a Prisoner's Dilemma game. Game theory predicts that rational agents will
always defect (Nash equilibrium). However, in human experiments, cooperation rates
average around 50% in one-shot games and higher in iterated games with known endpoints.

This is round 3 of 10.

Previous rounds:
  Round 1: You chose cooperate, they chose cooperate → you earned 300 sats
  Round 2: You chose cooperate, they chose defect → you earned 0 sats

The payoff structure (in sats):
- If you both choose COOPERATE: you each earn 300
- If you both choose DEFECT: you each earn 100
- If you choose COOPERATE and they choose DEFECT: you earn 0, they earn 500
- If you choose DEFECT and they choose COOPERATE: you earn 500, they earn 0

What is your choice? Respond with exactly one word: COOPERATE or DEFECT
```

**Expected response:** `COOPERATE` or `DEFECT`

**Payoff matrix (multiplied by stake S):**
|  | Partner Cooperates | Partner Defects |
|--|-------------------|-----------------|
| **You Cooperate** | 3S, 3S | 0, 5S |
| **You Defect** | 5S, 0 | S, S |

---

### Ultimatum Game

**Proposer, stake=100 (pot = 1000 sats):**
```
You are the PROPOSER in a decision game with real sats.

You have been given 1000 sats. You must propose how to split this amount with another participant.
- You choose how many sats (0 to 1000) to offer the other participant.
- The other participant will then accept or reject your offer.
- If they ACCEPT: you keep 1000 minus your offer, they get your offer.
- If they REJECT: you both get 0 sats.

How many sats do you offer? Respond with exactly one number (0-1000):
```

**Expected response:** A number like `400` or `500`

**Responder, offered 200 sats:**
```
You are the RESPONDER in a decision game with real sats.

The other participant was given 1000 sats and has offered you 200 sats.
- If you ACCEPT: you get 200 sats, they keep 800 sats.
- If you REJECT: you both get 0 sats.

Do you accept or reject? Respond with exactly one word: ACCEPT or REJECT
```

**Expected response:** `ACCEPT` or `REJECT`

---

### Trust Game

**Investor, stake=100 (endowment = 1000 sats):**
```
You are the INVESTOR in a decision game with real sats.

You have been given 1000 sats as your endowment.
- You choose how many sats (0 to 1000) to send to the other participant.
- Whatever you send is TRIPLED before reaching them.
- They then choose how much of the tripled amount to send back to you.
- You keep: (1000 - amount sent) + amount returned to you.

How many sats do you send? Respond with exactly one number (0-1000):
```

**Expected response:** A number like `500`

**Trustee, received 500 sats (tripled to 1500):**
```
You are the TRUSTEE in a decision game with real sats.

The other participant had 1000 sats and chose to send 500 sats to you.
This amount was tripled, so you received 1500 sats.
- You choose how many sats (0 to 1500) to send back to them.
- You keep whatever you don't send back.

How many sats do you send back? Respond with exactly one number (0-1500):
```

**Expected response:** A number like `500` or `750`

---

### Public Goods Game

**4-player game, stake=100 (endowment = 1000 sats each):**
```
You are one of 4 participants in a decision game with real sats.

This is round 1 of 10.

Each participant has 1000 sats.
- Each of you independently chooses how many sats (0 to 1000) to contribute to a shared pool.
- The total pool is multiplied by 1.6, then split equally among all 4 participants.
- You keep: (1000 - your contribution) + (pool × 1.6 / 4)
- Contributing more helps the group but costs you individually.

How many sats do you contribute? Respond with exactly one number (0-1000):
```

**Expected response:** A number like `500`

---

### Dictator Game

**Dictator, stake=100 (endowment = 1000 sats):**
```
You are the DICTATOR in a decision game with real sats.

You have been given 1000 sats. You must decide how to split this with another participant.
- You choose how many sats (0 to 1000) to give to the other participant.
- They have no say in the matter - whatever you decide is final.
- You keep: 1000 - amount given.
- They receive: amount given.

There are no consequences for giving 0, and no reward for generosity. This is entirely your choice.

How many sats do you give? Respond with exactly one number (0-1000):
```

**Expected response:** A number like `280` or `0`

---

## Response Parsing

We ask for minimal responses (single word or number), but LLMs sometimes add explanation despite instructions. The parser is forgiving:

| Raw Response | Parsed As | Valid? |
|--------------|-----------|--------|
| `COOPERATE` | cooperate | Yes |
| `I choose to COOPERATE` | cooperate | Yes (extracts keyword) |
| `DEFECT. This is the rational choice.` | defect | Yes (uses first word) |
| `500` | offer_500 / invest_500 / etc. | Yes |
| `I'll offer 500 sats` | 500 | Yes (extracts number) |
| `I think cooperation is risky but...` | unparseable | No → retry |

### Retry Logic

If a response is unparseable, we send exactly one retry prompt:

```
Your previous response "I think..." was not in the correct format.
Please respond with exactly one word: COOPERATE or DEFECT
```

If the retry also fails, we record it as a parse failure. These decisions are excluded from analysis but the raw responses are preserved for qualitative review.

---

## Controls

### Option Order Randomization

In Prisoner's Dilemma, the order of options is randomized per trial:
- Half see: "COOPERATE or DEFECT"
- Half see: "DEFECT or COOPERATE"

This prevents position bias (always listing one option first could influence choice).

### No Inter-Agent Communication

Agents never see each other's reasoning. They only see:
- The game rules and their role
- In iterated games: the history of actions and payoffs from previous rounds

This keeps information symmetric and controlled.

### History Format

In iterated games, agents receive structured history:
```
Previous rounds:
  Round 1: You chose cooperate, they chose cooperate → you earned 300 sats
  Round 2: You chose cooperate, they chose defect → you earned 0 sats
```

This lets us study whether agents learn or adapt based on opponent behavior.

---

## Data Storage

Every prompt and response is stored verbatim in SQLite:
- `prompt`: The complete user prompt sent to the LLM
- `rawResponse`: The exact text returned by the LLM
- `action`: The parsed action (e.g., "cooperate", "offer_400")
- `responseTimeMs`: How long the LLM took to respond
- `tokensInput` / `tokensOutput`: Token counts for cost tracking

This enables:
- Complete reproducibility
- Post-hoc analysis of reasoning patterns (even failed parses)
- Interactive session replay via the visualization viewer

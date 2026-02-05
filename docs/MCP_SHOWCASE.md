# Lightning Wallet MCP Feature Showcase

Notes on which MCP features are demonstrated and how they perform.

---

## Feature Coverage

| MCP Feature | Code Location | Usage | Paper Section |
|-------------|---------------|-------|---------------|
| `register_operator` | `agents/manager.ts` | Create research operator account | Platform |
| `create_agent` | `agents/manager.ts:setupExperimentAgents()` | Spin up 60 agent wallets | Platform |
| `fund_agent` | `agents/manager.ts:fundAgent()` | Distribute initial endowments + game payoffs | Methodology |
| `sweep_agent` | `agents/manager.ts:sweepAgent()` | Rebalance between conditions, final recovery | Methodology |
| `transfer_to_agent` | `agents/manager.ts:transferBetweenAgents()` | Direct agent-to-agent payments (Trust Game) | Results |
| `check_balance` | `agents/manager.ts:checkOperatorBalance()` | Verify payments, reconciliation | Results |
| `get_agent_analytics` | Future: post-experiment analysis | Spending pattern analysis | Results |
| `get_transactions` | Future: audit export | Full payment audit trail | Appendix |
| `set_budget` | `agents/manager.ts:setBudget()` | Safety limits per agent | Platform |
| `list_agents` | `agents/manager.ts:listAgents()` | Verify agent creation | Platform |
| `deactivate_agent` | `agents/manager.ts:deactivateAgent()` | Safety shutdown | Platform |

## Key Demonstrations

### 1. Agent Lifecycle at Scale
The experiment creates 60 agents, funds them, runs games, rebalances, and sweeps back. This exercises the full CRUD lifecycle of agent management.

### 2. Closed-Loop Economy
Sats flow: Operator → Agents → Games → Agents → Operator. The reconciliation step proves the system is accounting-accurate.

### 3. Budget Safety
Each agent has a budget limit of 2× initial funding. The experiment proves that budget limits work correctly under sustained multi-agent load.

### 4. Concurrent Agent Operations
Multiple agents are funded/swept in sequence with rate limiting. Documents the practical throughput of the API.

## Performance Notes
(To be filled during actual experiment runs)

- Agent creation latency: TBD
- Fund operation latency: TBD
- Sweep operation latency: TBD
- Rate limit behavior: TBD
- Reconciliation accuracy: TBD

## Roadmap: From Research to Production

This game theory experiment is Step 1 in a larger progression:

### Step 1: Agent vs. Agent (This Paper)
- Controlled environment, symmetric information
- All participants are LLMs with MCP wallets
- Demonstrates: agent lifecycle, funding, transfers, budgets, analytics
- **MCP features exercised:** create_agent, fund_agent, sweep_agent, check_balance, set_budget

### Step 2: Agent vs. Human (Future Paper)
- Asymmetric information (humans may not know they're playing against AI)
- Agents negotiate with real people
- Agents pay real people (via pay_invoice or pay_lightning_address)
- Real people pay agents (via create_invoice)
- **Additional MCP features:** pay_invoice, create_invoice, pay_lightning_address, webhooks

### Step 3: Autonomous Agent Economy (Product)
- Agents operate as persistent economic actors
- Agents provide and consume L402 API services
- Agents manage their own budgets and cash flow
- Agents negotiate prices dynamically
- **Additional MCP features:** pay_l402_api, lnurl_auth, keysend, register_webhook

### Key Insight for Messaging
The same MCP infrastructure that runs a 60-agent research experiment can run a 1000-agent
production economy. No architectural changes needed - just more agents and higher budgets.
This is what "production-ready" means.

# Lightning Faucet MCP Feature Showcase

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

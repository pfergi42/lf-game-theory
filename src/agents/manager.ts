import type { AgentConfig } from '../types.js';

const API_URL = 'https://lightningfaucet.com/api/';

interface LFAgent {
  id: number;
  name: string;
  api_key: string;
  balance_sats: number;
  budget_limit_sats?: number;
  is_active: number;
}

interface LFResponse {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

export class AgentManager {
  private operatorKey: string;
  private agents: Map<string, { lightningId: number; apiKey: string }> = new Map();

  constructor(operatorKey: string) {
    this.operatorKey = operatorKey;
  }

  private async request(
    action: string,
    params: Record<string, unknown> = {},
    apiKey?: string
  ): Promise<LFResponse> {
    const key = apiKey || this.operatorKey;

    const body = {
      action,
      api_key: key,
      ...params,
    };

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json() as LFResponse;

    if (!data.success) {
      throw new Error(`Lightning Faucet API error: ${data.error || 'Unknown error'}`);
    }

    return data;
  }

  async checkOperatorBalance(): Promise<number> {
    const result = await this.request('whoami');
    return result.balance_sats as number;
  }

  async createLightningAgent(name: string, budgetLimit?: number): Promise<{ id: number; apiKey: string }> {
    const params: Record<string, unknown> = { name };
    if (budgetLimit !== undefined) {
      params.budget_limit_sats = budgetLimit;
    }

    const result = await this.request('create_agent', params);

    return {
      id: result.agent_id as number,
      apiKey: result.api_key as string,
    };
  }

  async fundAgent(agentId: number, amountSats: number): Promise<void> {
    await this.request('fund_agent', {
      agent_id: agentId,
      amount_sats: amountSats,
    });
  }

  async sweepAgent(agentId: number, amountSats: number): Promise<void> {
    await this.request('withdraw_from_agent', {
      agent_id: agentId,
      amount_sats: amountSats,
    });
  }

  async getAgentBalance(agentId: number): Promise<number> {
    const agents = await this.listAgents();
    const agent = agents.find(a => a.id === agentId);
    return agent?.balance_sats ?? 0;
  }

  async listAgents(): Promise<LFAgent[]> {
    const result = await this.request('list_agents');
    return (result.agents || []) as LFAgent[];
  }

  async deleteAgent(agentId: number): Promise<void> {
    await this.request('delete_agent', {
      agent_id: agentId,
      confirm: true,
    });
  }

  async transferBetweenAgents(fromAgentId: number, toAgentId: number, amount: number): Promise<void> {
    // Two-step: sweep from source agent to operator, then fund destination
    await this.sweepAgent(fromAgentId, amount);
    await this.fundAgent(toAgentId, amount);
  }

  async setBudget(agentId: number, budgetLimitSats: number): Promise<void> {
    await this.request('set_budget', {
      agent_id: agentId,
      budget_limit_sats: budgetLimitSats,
    });
  }

  async deactivateAgent(agentId: number): Promise<void> {
    await this.request('deactivate_agent', {
      agent_id: agentId,
    });
  }

  // --- High-level experiment operations ---

  async setupExperimentAgents(
    agents: AgentConfig[],
    fundingPerAgent: number
  ): Promise<Map<string, { lightningId: number; apiKey: string }>> {
    console.log(`Setting up ${agents.length} Lightning agents with ${fundingPerAgent} sats each...`);

    for (const agent of agents) {
      try {
        // No budget limit for experiment agents - we manage balances directly
        const lfAgent = await this.createLightningAgent(
          `exp-${agent.id.slice(0, 8)}-${agent.name}`
        );

        await this.fundAgent(lfAgent.id, fundingPerAgent);

        this.agents.set(agent.id, {
          lightningId: lfAgent.id,
          apiKey: lfAgent.apiKey,
        });

        console.log(`  Created agent ${agent.name}: LN#${lfAgent.id}, funded ${fundingPerAgent} sats`);

        // Rate limit protection
        await sleep(200);
      } catch (err) {
        console.error(`  Failed to create agent ${agent.name}:`, err);
        throw err;
      }
    }

    return this.agents;
  }

  async rebalanceAgents(agents: AgentConfig[], targetBalance: number): Promise<void> {
    console.log(`Rebalancing ${agents.length} agents to ${targetBalance} sats each...`);

    for (const agent of agents) {
      const lnInfo = this.agents.get(agent.id);
      if (!lnInfo) continue;

      const currentBalance = await this.getAgentBalance(lnInfo.lightningId);
      const diff = currentBalance - targetBalance;

      // Skip small differences (within 10% of target)
      if (Math.abs(diff) < targetBalance * 0.1) {
        continue;
      }

      try {
        if (diff > 0) {
          await this.sweepAgent(lnInfo.lightningId, diff);
        } else if (diff < 0) {
          await this.fundAgent(lnInfo.lightningId, Math.abs(diff));
        }
      } catch (err) {
        console.warn(`  Rebalance skipped for agent ${agent.name}: ${err instanceof Error ? err.message : 'unknown'}`);
      }

      await sleep(100);
    }
  }

  async sweepAllAgents(): Promise<number> {
    console.log('Sweeping all agent balances back to operator...');
    let totalSwept = 0;

    for (const [agentId, lnInfo] of this.agents) {
      try {
        const balance = await this.getAgentBalance(lnInfo.lightningId);
        if (balance > 0) {
          await this.sweepAgent(lnInfo.lightningId, balance);
          totalSwept += balance;
          console.log(`  Swept ${balance} sats from agent ${agentId}`);
        }
        await sleep(100);
      } catch (err) {
        console.error(`  Failed to sweep agent ${agentId}:`, err);
      }
    }

    console.log(`Total swept: ${totalSwept} sats`);
    return totalSwept;
  }

  async distributePayoff(
    sessionId: string,
    agentId: string,
    amount: number
  ): Promise<void> {
    const lnInfo = this.agents.get(agentId);
    if (!lnInfo) {
      throw new Error(`No Lightning agent found for ${agentId}`);
    }

    if (amount > 0) {
      await this.fundAgent(lnInfo.lightningId, amount);
    } else if (amount < 0) {
      await this.sweepAgent(lnInfo.lightningId, Math.abs(amount));
    }
  }

  getLightningInfo(agentId: string): { lightningId: number; apiKey: string } | undefined {
    return this.agents.get(agentId);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

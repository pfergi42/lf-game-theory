import type { AgentConfig } from '../types.js';

const API_BASE = 'https://lightningfaucet.com/api/v1';

interface LFAgent {
  id: number;
  name: string;
  api_key: string;
  balance: number;
  budget_limit_sats?: number;
  status: string;
}

interface LFResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export class AgentManager {
  private operatorKey: string;
  private agents: Map<string, { lightningId: number; apiKey: string }> = new Map();

  constructor(operatorKey: string) {
    this.operatorKey = operatorKey;
  }

  private async request<T>(
    endpoint: string,
    method: string = 'GET',
    body?: Record<string, unknown>,
    apiKey?: string
  ): Promise<T> {
    const key = apiKey || this.operatorKey;
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
    };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await response.json() as LFResponse<T>;

    if (!response.ok || !data.success) {
      throw new Error(`Lightning Faucet API error: ${data.error || response.statusText}`);
    }

    return data.data as T;
  }

  async checkOperatorBalance(): Promise<number> {
    const result = await this.request<{ balance: number }>('/balance');
    return result.balance;
  }

  async createLightningAgent(name: string, budgetLimit?: number): Promise<LFAgent> {
    const body: Record<string, unknown> = { name };
    if (budgetLimit !== undefined) {
      body.budget_limit_sats = budgetLimit;
    }
    return this.request<LFAgent>('/agents', 'POST', body);
  }

  async fundAgent(agentId: number, amountSats: number): Promise<void> {
    await this.request('/agents/fund', 'POST', {
      agent_id: agentId,
      amount_sats: amountSats,
    });
  }

  async sweepAgent(agentId: number, amountSats: number): Promise<void> {
    await this.request('/agents/sweep', 'POST', {
      agent_id: agentId,
      amount_sats: amountSats,
    });
  }

  async getAgentBalance(agentId: number): Promise<number> {
    const agents = await this.request<LFAgent[]>('/agents');
    const agent = agents.find(a => a.id === agentId);
    return agent?.balance ?? 0;
  }

  async listAgents(): Promise<LFAgent[]> {
    return this.request<LFAgent[]>('/agents');
  }

  async transferBetweenAgents(fromAgentId: number, toAgentId: number, amount: number): Promise<void> {
    await this.request('/agents/transfer', 'POST', {
      from_agent_id: fromAgentId,
      to_agent_id: toAgentId,
      amount_sats: amount,
    });
  }

  async setBudget(agentId: number, budgetLimitSats: number): Promise<void> {
    await this.request('/agents/budget', 'POST', {
      agent_id: agentId,
      budget_limit_sats: budgetLimitSats,
    });
  }

  async deactivateAgent(agentId: number): Promise<void> {
    await this.request(`/agents/${agentId}/deactivate`, 'POST');
  }

  // --- High-level experiment operations ---

  async setupExperimentAgents(
    agents: AgentConfig[],
    fundingPerAgent: number
  ): Promise<Map<string, { lightningId: number; apiKey: string }>> {
    console.log(`Setting up ${agents.length} Lightning agents with ${fundingPerAgent} sats each...`);

    for (const agent of agents) {
      try {
        const lfAgent = await this.createLightningAgent(
          `exp-${agent.id.slice(0, 8)}-${agent.name}`,
          fundingPerAgent * 2 // budget = 2x initial funding
        );

        await this.fundAgent(lfAgent.id, fundingPerAgent);

        this.agents.set(agent.id, {
          lightningId: lfAgent.id,
          apiKey: lfAgent.api_key,
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

      if (diff > 0) {
        await this.sweepAgent(lnInfo.lightningId, diff);
      } else if (diff < 0) {
        await this.fundAgent(lnInfo.lightningId, Math.abs(diff));
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

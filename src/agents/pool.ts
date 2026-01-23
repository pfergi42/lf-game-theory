import { AgentManager } from './manager.js';
import type { AgentConfig } from '../types.js';

export class OperatorPool {
  private manager: AgentManager;
  private initialDeposit: number;
  private totalDistributed: number = 0;
  private totalRecovered: number = 0;

  constructor(manager: AgentManager, initialDeposit: number) {
    this.manager = manager;
    this.initialDeposit = initialDeposit;
  }

  async verifyOperatorBalance(): Promise<{ balance: number; sufficient: boolean }> {
    const balance = await this.manager.checkOperatorBalance();
    return {
      balance,
      sufficient: balance >= this.initialDeposit,
    };
  }

  async distributeEvenly(agents: AgentConfig[], totalAmount: number): Promise<void> {
    const perAgent = Math.floor(totalAmount / agents.length);
    console.log(`Distributing ${perAgent} sats each to ${agents.length} agents (total: ${perAgent * agents.length})`);

    for (const agent of agents) {
      const lnInfo = this.manager.getLightningInfo(agent.id);
      if (!lnInfo) continue;
      await this.manager.fundAgent(lnInfo.lightningId, perAgent);
      this.totalDistributed += perAgent;
      await sleep(100);
    }
  }

  async recoverAll(agents: AgentConfig[]): Promise<number> {
    const recovered = await this.manager.sweepAllAgents();
    this.totalRecovered += recovered;
    return recovered;
  }

  async getReconciliation(agents: AgentConfig[]): Promise<{
    operatorBalance: number;
    totalAgentBalances: number;
    totalDistributed: number;
    totalRecovered: number;
    discrepancy: number;
  }> {
    const operatorBalance = await this.manager.checkOperatorBalance();
    let totalAgentBalances = 0;

    for (const agent of agents) {
      const lnInfo = this.manager.getLightningInfo(agent.id);
      if (!lnInfo) continue;
      const balance = await this.manager.getAgentBalance(lnInfo.lightningId);
      totalAgentBalances += balance;
      await sleep(50);
    }

    const expectedTotal = this.initialDeposit;
    const actualTotal = operatorBalance + totalAgentBalances;

    return {
      operatorBalance,
      totalAgentBalances,
      totalDistributed: this.totalDistributed,
      totalRecovered: this.totalRecovered,
      discrepancy: actualTotal - expectedTotal,
    };
  }

  getStats(): { distributed: number; recovered: number; net: number } {
    return {
      distributed: this.totalDistributed,
      recovered: this.totalRecovered,
      net: this.totalDistributed - this.totalRecovered,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

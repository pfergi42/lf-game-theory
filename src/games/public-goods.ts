import type { AgentConfig, GameResult } from '../types.js';
import { BaseGame } from './engine.js';

export class PublicGoodsGame extends BaseGame {
  get playersPerSession(): number { return 4; }
  get roles(): string[] { return ['contributor', 'contributor', 'contributor', 'contributor']; }

  protected async playRound(
    sessionId: string,
    agents: AgentConfig[],
    round: number,
    totalRounds: number,
    history: Map<string, Array<{ round: number; myAction: string; theirAction: string; myPayoff: number }>>
  ): Promise<GameResult> {
    const endowment = 10 * this.config.stake;
    const multiplier = 1.6;
    const numPlayers = 4;

    // All players contribute simultaneously
    const contributions: Array<{ agentId: string; contribution: number }> = [];

    for (const agent of agents) {
      const decision = await this.getAgentDecision(sessionId, agent, {
        gameType: 'public-goods',
        primingCondition: agent.primingCondition,
        stake: this.config.stake,
        round,
        totalRounds,
        endowment,
        history: history.get(agent.id),
      }, round);

      const contribution = extractNumber(decision.parsedValue, endowment);
      contributions.push({ agentId: agent.id, contribution });
    }

    // Calculate pool and payoffs
    const totalContributions = contributions.reduce((sum, c) => sum + c.contribution, 0);
    const poolReturn = (totalContributions * multiplier) / numPlayers;

    const players = contributions.map(c => ({
      agentId: c.agentId,
      action: `contribute_${c.contribution}`,
      payoff: Math.round((endowment - c.contribution) + poolReturn),
    }));

    return {
      sessionId,
      round,
      players,
      metadata: {
        contributions: contributions.map(c => c.contribution),
        totalContributions,
        poolReturn: Math.round(poolReturn),
        multiplier,
        endowment,
      },
    };
  }
}

function extractNumber(parsedValue: Record<string, unknown>, max: number): number {
  for (const key of ['contribution', 'investment', 'give', 'offer']) {
    if (typeof parsedValue[key] === 'number') {
      return Math.max(0, Math.min(max, parsedValue[key] as number));
    }
  }
  for (const val of Object.values(parsedValue)) {
    if (typeof val === 'number' && val >= 0) {
      return Math.min(max, val);
    }
  }
  return 0;
}

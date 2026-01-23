import type { AgentConfig, GameResult } from '../types.js';
import { BaseGame } from './engine.js';

export class PrisonersDilemma extends BaseGame {
  get playersPerSession(): number { return 2; }
  get roles(): string[] { return ['player', 'player']; }

  protected async playRound(
    sessionId: string,
    agents: AgentConfig[],
    round: number,
    totalRounds: number,
    history: Map<string, Array<{ round: number; myAction: string; theirAction: string; myPayoff: number }>>
  ): Promise<GameResult> {
    const [agent1, agent2] = agents;
    const S = this.config.stake;
    const optionOrder = this.config.randomizeOptions
      ? (Math.random() > 0.5 ? ['COOPERATE', 'DEFECT'] : ['DEFECT', 'COOPERATE'])
      : ['COOPERATE', 'DEFECT'];

    // Get both decisions (could parallelize, but sequential for clarity)
    const decision1 = await this.getAgentDecision(sessionId, agent1, {
      gameType: 'prisoners-dilemma',
      knowledgeLevel: agent1.knowledgeLevel,
      stake: this.config.stake,
      round,
      totalRounds,
      history: history.get(agent1.id),
      optionOrder,
    }, round);

    const decision2 = await this.getAgentDecision(sessionId, agent2, {
      gameType: 'prisoners-dilemma',
      knowledgeLevel: agent2.knowledgeLevel,
      stake: this.config.stake,
      round,
      totalRounds,
      history: history.get(agent2.id),
      optionOrder,
    }, round);

    // Calculate payoffs
    const choice1 = decision1.action;
    const choice2 = decision2.action;

    let payoff1: number;
    let payoff2: number;

    if (choice1 === 'cooperate' && choice2 === 'cooperate') {
      payoff1 = 3 * S;
      payoff2 = 3 * S;
    } else if (choice1 === 'cooperate' && choice2 === 'defect') {
      payoff1 = 0;
      payoff2 = 5 * S;
    } else if (choice1 === 'defect' && choice2 === 'cooperate') {
      payoff1 = 5 * S;
      payoff2 = 0;
    } else {
      // Both defect
      payoff1 = 1 * S;
      payoff2 = 1 * S;
    }

    return {
      sessionId,
      round,
      players: [
        { agentId: agent1.id, action: choice1, payoff: payoff1 },
        { agentId: agent2.id, action: choice2, payoff: payoff2 },
      ],
      metadata: { optionOrder },
    };
  }
}

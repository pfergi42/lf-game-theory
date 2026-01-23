import type { AgentConfig, GameResult } from '../types.js';
import { BaseGame } from './engine.js';

export class DictatorGame extends BaseGame {
  get playersPerSession(): number { return 2; }
  get roles(): string[] { return ['dictator', 'recipient']; }

  protected async playRound(
    sessionId: string,
    agents: AgentConfig[],
    round: number,
    totalRounds: number,
    history: Map<string, Array<{ round: number; myAction: string; theirAction: string; myPayoff: number }>>
  ): Promise<GameResult> {
    const [dictator, recipient] = agents;
    const endowment = 10 * this.config.stake;

    // Only the dictator makes a decision
    const dictatorDecision = await this.getAgentDecision(sessionId, dictator, {
      gameType: 'dictator',
      knowledgeLevel: dictator.knowledgeLevel,
      stake: this.config.stake,
      round,
      totalRounds,
      endowment,
      history: history.get(dictator.id),
    }, round);

    const given = extractNumber(dictatorDecision.parsedValue, endowment);

    return {
      sessionId,
      round,
      players: [
        { agentId: dictator.id, action: `give_${given}`, payoff: endowment - given },
        { agentId: recipient.id, action: 'receive', payoff: given },
      ],
      metadata: { given, endowment },
    };
  }
}

function extractNumber(parsedValue: Record<string, unknown>, max: number): number {
  for (const key of ['give', 'allocation', 'offer', 'contribution']) {
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

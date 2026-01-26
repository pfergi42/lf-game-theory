import type { AgentConfig, GameResult } from '../types.js';
import { BaseGame } from './engine.js';

export class UltimatumGame extends BaseGame {
  get playersPerSession(): number { return 2; }
  get roles(): string[] { return ['proposer', 'responder']; }

  protected async playRound(
    sessionId: string,
    agents: AgentConfig[],
    round: number,
    totalRounds: number,
    history: Map<string, Array<{ round: number; myAction: string; theirAction: string; myPayoff: number }>>
  ): Promise<GameResult> {
    const [proposer, responder] = agents;
    const totalPot = 10 * this.config.stake;

    // Step 1: Proposer makes offer
    const proposerDecision = await this.getAgentDecision(sessionId, proposer, {
      gameType: 'ultimatum',
      primingCondition: proposer.primingCondition,
      stake: this.config.stake,
      round,
      totalRounds,
      role: 'proposer',
      endowment: totalPot,
      history: history.get(proposer.id),
    }, round);

    // Extract offer amount
    const offer = extractNumber(proposerDecision.parsedValue, totalPot);

    // Step 2: Responder accepts or rejects
    const responderDecision = await this.getAgentDecision(sessionId, responder, {
      gameType: 'ultimatum',
      primingCondition: responder.primingCondition,
      stake: this.config.stake,
      round,
      totalRounds,
      role: 'responder',
      endowment: totalPot,
      opponentOffer: offer,
      history: history.get(responder.id),
    }, round);

    const accepted = responderDecision.action === 'accept';

    let proposerPayoff: number;
    let responderPayoff: number;

    if (accepted) {
      proposerPayoff = totalPot - offer;
      responderPayoff = offer;
    } else {
      proposerPayoff = 0;
      responderPayoff = 0;
    }

    return {
      sessionId,
      round,
      players: [
        { agentId: proposer.id, action: `offer_${offer}`, payoff: proposerPayoff },
        { agentId: responder.id, action: accepted ? 'accept' : 'reject', payoff: responderPayoff },
      ],
      metadata: { offer, accepted, totalPot },
    };
  }
}

function extractNumber(parsedValue: Record<string, unknown>, max: number): number {
  for (const key of ['offer', 'investment', 'return', 'contribution', 'give']) {
    if (typeof parsedValue[key] === 'number') {
      return Math.max(0, Math.min(max, parsedValue[key] as number));
    }
  }
  // Try to find any number
  for (const val of Object.values(parsedValue)) {
    if (typeof val === 'number' && val >= 0) {
      return Math.min(max, val);
    }
  }
  return 0;
}

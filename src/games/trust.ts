import type { AgentConfig, GameResult } from '../types.js';
import { BaseGame } from './engine.js';

export class TrustGame extends BaseGame {
  get playersPerSession(): number { return 2; }
  get roles(): string[] { return ['investor', 'trustee']; }

  protected async playRound(
    sessionId: string,
    agents: AgentConfig[],
    round: number,
    totalRounds: number,
    history: Map<string, Array<{ round: number; myAction: string; theirAction: string; myPayoff: number }>>
  ): Promise<GameResult> {
    const [investor, trustee] = agents;
    const endowment = 10 * this.config.stake;

    // Step 1: Investor decides how much to send
    const investorDecision = await this.getAgentDecision(sessionId, investor, {
      gameType: 'trust',
      knowledgeLevel: investor.knowledgeLevel,
      stake: this.config.stake,
      round,
      totalRounds,
      role: 'investor',
      endowment,
      history: history.get(investor.id),
    }, round);

    const investment = extractNumber(investorDecision.parsedValue, endowment);
    const tripled = investment * 3;

    // Step 2: Trustee decides how much to return
    const trusteeDecision = await this.getAgentDecision(sessionId, trustee, {
      gameType: 'trust',
      knowledgeLevel: trustee.knowledgeLevel,
      stake: this.config.stake,
      round,
      totalRounds,
      role: 'trustee',
      endowment,
      investmentReceived: investment,
      history: history.get(trustee.id),
    }, round);

    const returned = extractNumber(trusteeDecision.parsedValue, tripled);

    // Calculate payoffs
    const investorPayoff = (endowment - investment) + returned;
    const trusteePayoff = tripled - returned;

    return {
      sessionId,
      round,
      players: [
        { agentId: investor.id, action: `invest_${investment}`, payoff: investorPayoff },
        { agentId: trustee.id, action: `return_${returned}`, payoff: trusteePayoff },
      ],
      metadata: { investment, tripled, returned, endowment },
    };
  }
}

function extractNumber(parsedValue: Record<string, unknown>, max: number): number {
  for (const key of ['investment', 'return', 'offer', 'contribution', 'give']) {
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

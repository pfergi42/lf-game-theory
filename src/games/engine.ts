import { v4 as uuid } from 'uuid';
import type {
  AgentConfig,
  GameResult,
  GameSession,
  GameType,
  IterationType,
  MatchGroup,
  MatchPair,
  StakeSize,
} from '../types.js';
import { LLMRouter } from '../llm/router.js';
import { buildPrompt, getOptionOrder } from '../llm/prompts.js';
import { parseResponse, isRetryable, buildRetryPrompt } from '../llm/parser.js';
import { DataStore } from '../data/store.js';
import { AgentManager } from '../agents/manager.js';

export interface GameConfig {
  gameType: GameType;
  stake: StakeSize;
  iteration: IterationType;
  randomizeOptions: boolean;
}

export abstract class BaseGame {
  protected config: GameConfig;
  protected llm: LLMRouter;
  protected store: DataStore;
  protected agentManager: AgentManager;

  constructor(config: GameConfig, llm: LLMRouter, store: DataStore, agentManager: AgentManager) {
    this.config = config;
    this.llm = llm;
    this.store = store;
    this.agentManager = agentManager;
  }

  abstract get playersPerSession(): number;
  abstract get roles(): string[];

  getTotalRounds(): number {
    switch (this.config.iteration) {
      case 'one-shot': return 1;
      case '10-round': return 10;
      case '50-round': return 50;
    }
  }

  async runSession(
    experimentId: string,
    agents: AgentConfig[],
    conditionIndex?: number
  ): Promise<GameResult[]> {
    const sessionId = uuid();
    const totalRounds = this.getTotalRounds();

    this.store.createSession({
      id: sessionId,
      experimentId,
      gameType: this.config.gameType,
      stake: this.config.stake,
      iteration: this.config.iteration,
      round: 0,
      totalRounds,
      players: agents.map(a => a.id),
      conditionIndex,
    });

    this.store.updateSessionStatus(sessionId, 'in-progress');
    const results: GameResult[] = [];

    try {
      for (let round = 1; round <= totalRounds; round++) {
        const roundHistory = this.getRoundHistory(sessionId, agents);
        const result = await this.playRound(sessionId, agents, round, totalRounds, roundHistory);
        results.push(result);

        // Distribute payoffs
        for (const player of result.players) {
          if (player.payoff !== 0) {
            await this.agentManager.distributePayoff(sessionId, player.agentId, player.payoff);
            this.store.recordPayment({
              sessionId,
              fromAgentId: player.payoff > 0 ? null : player.agentId,
              toAgentId: player.payoff > 0 ? player.agentId : 'operator',
              amount: Math.abs(player.payoff),
              reason: `${this.config.gameType} round ${round} payoff`,
            });
          }
        }
      }

      this.store.updateSessionStatus(sessionId, 'completed');
    } catch (err) {
      this.store.updateSessionStatus(sessionId, 'error');
      this.store.log(experimentId, 'error', `Session ${sessionId} failed: ${err}`);
      throw err;
    }

    return results;
  }

  protected abstract playRound(
    sessionId: string,
    agents: AgentConfig[],
    round: number,
    totalRounds: number,
    history: Map<string, Array<{ round: number; myAction: string; theirAction: string; myPayoff: number }>>
  ): Promise<GameResult>;

  protected async getAgentDecision(
    sessionId: string,
    agent: AgentConfig,
    promptContext: Parameters<typeof buildPrompt>[0],
    round: number
  ): Promise<{ action: string; parsedValue: Record<string, unknown>; rawResponse: string; responseTimeMs: number; tokensInput: number; tokensOutput: number }> {
    const { system, user, optionOrder } = buildPrompt(promptContext);

    const response = await this.llm.query({
      model: agent.model,
      modelId: agent.modelId,
      prompt: user,
      systemPrompt: system,
      temperature: 0,
      maxTokens: 50,
    });

    let result = parseResponse(this.config.gameType, response.content, {
      role: promptContext.role,
      maxAmount: promptContext.endowment || (10 * this.config.stake),
      options: optionOrder,
    });

    // Retry once if unparseable
    if (isRetryable(result)) {
      const retryPrompt = buildRetryPrompt(this.config.gameType, response.content, { role: promptContext.role });
      const retryResponse = await this.llm.query({
        model: agent.model,
        modelId: agent.modelId,
        prompt: retryPrompt,
        systemPrompt: system,
        temperature: 0,
        maxTokens: 50,
      });
      result = parseResponse(this.config.gameType, retryResponse.content, {
        role: promptContext.role,
        maxAmount: promptContext.endowment || (10 * this.config.stake),
        options: optionOrder,
      });
    }

    // Record decision
    this.store.recordDecision({
      sessionId,
      agentId: agent.id,
      round,
      action: result.action,
      parsedAction: result.parsedValue,
      rawResponse: response.content,
      prompt: user,
      payoff: 0, // updated after payoff calculation
      responseTimeMs: response.responseTimeMs,
      tokensInput: response.tokensUsed.input,
      tokensOutput: response.tokensUsed.output,
      optionOrder,
    });

    return {
      action: result.action,
      parsedValue: result.parsedValue,
      rawResponse: response.content,
      responseTimeMs: response.responseTimeMs,
      tokensInput: response.tokensUsed.input,
      tokensOutput: response.tokensUsed.output,
    };
  }

  private getRoundHistory(
    sessionId: string,
    agents: AgentConfig[]
  ): Map<string, Array<{ round: number; myAction: string; theirAction: string; myPayoff: number }>> {
    const history = new Map<string, Array<{ round: number; myAction: string; theirAction: string; myPayoff: number }>>();

    for (const agent of agents) {
      const decisions = this.store.getDecisions(sessionId);
      const agentHistory: Array<{ round: number; myAction: string; theirAction: string; myPayoff: number }> = [];

      const rounds = new Set(decisions.map(d => d.round));
      for (const round of rounds) {
        const roundDecisions = decisions.filter(d => d.round === round);
        const myDecision = roundDecisions.find(d => d.agentId === agent.id);
        const theirDecision = roundDecisions.find(d => d.agentId !== agent.id);
        if (myDecision && theirDecision) {
          agentHistory.push({
            round,
            myAction: myDecision.action,
            theirAction: theirDecision.action,
            myPayoff: myDecision.payoff,
          });
        }
      }

      history.set(agent.id, agentHistory);
    }

    return history;
  }
}

// --- Matching utilities ---

export function generatePairs(agents: AgentConfig[]): MatchPair[] {
  const pairs: MatchPair[] = [];
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      pairs.push({ player1: agents[i].id, player2: agents[j].id });
    }
  }
  return shuffleArray(pairs);
}

export function generateGroups(agents: AgentConfig[], groupSize: number): MatchGroup[] {
  const shuffled = shuffleArray([...agents]);
  const groups: MatchGroup[] = [];
  for (let i = 0; i + groupSize <= shuffled.length; i += groupSize) {
    groups.push({ players: shuffled.slice(i, i + groupSize).map(a => a.id) });
  }
  return groups;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export type GameType = 'prisoners-dilemma' | 'ultimatum' | 'trust' | 'public-goods' | 'dictator';
export type ModelProvider = 'claude' | 'openai';
export type PrimingCondition = 'neutral' | 'self-interest' | 'cooperative';
export type StakeSize = 1 | 10 | 100 | 1000;
export type IterationType = 'one-shot' | '10-round' | '50-round';

export interface AgentConfig {
  id: string;
  name: string;
  model: ModelProvider;
  modelId: string;
  primingCondition: PrimingCondition;
  lightningAgentId?: number;
  lightningApiKey?: string;
  balance?: number;
}

export interface ExperimentConfig {
  name: string;
  description: string;
  agents: {
    countPerGroup: number;
    groups: Array<{
      model: ModelProvider;
      modelId: string;
      primingCondition: PrimingCondition;
    }>;
  };
  games: GameType[];
  stakes: StakeSize[];
  iterations: IterationType[];
  temperature: number;
  randomizeOptionOrder: boolean;
  counterbalanceGameOrder: boolean;
}

export interface GameSession {
  id: string;
  experimentId: string;
  gameType: GameType;
  stake: StakeSize;
  iteration: IterationType;
  round: number;
  totalRounds: number;
  players: string[]; // agent IDs
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  startedAt?: string;
  completedAt?: string;
}

export interface Decision {
  id: string;
  sessionId: string;
  agentId: string;
  round: number;
  action: string; // game-specific action
  rawResponse: string; // full LLM response
  prompt: string; // full prompt sent
  parsedAction: Record<string, unknown>;
  payoff: number; // sats earned/lost
  responseTimeMs: number;
  timestamp: string;
}

export interface Payment {
  id: string;
  sessionId: string;
  fromAgentId: string | null; // null = operator
  toAgentId: string;
  amount: number; // sats
  reason: string;
  lightningTxId?: string;
  timestamp: string;
}

// Game-specific action types
export interface PDAction {
  choice: 'cooperate' | 'defect';
}

export interface UltimatumProposal {
  role: 'proposer';
  offer: number; // sats offered to responder
}

export interface UltimatumResponse {
  role: 'responder';
  accept: boolean;
}

export interface TrustInvestment {
  role: 'investor';
  amount: number; // sats sent
}

export interface TrustReturn {
  role: 'trustee';
  amount: number; // sats returned
}

export interface PublicGoodsContribution {
  contribution: number; // sats contributed to pool
}

export interface DictatorAllocation {
  give: number; // sats given to recipient
}

export interface GameResult {
  sessionId: string;
  round: number;
  players: Array<{
    agentId: string;
    action: string;
    payoff: number;
  }>;
  metadata?: Record<string, unknown>;
}

export interface MatchPair {
  player1: string;
  player2: string;
}

export interface MatchGroup {
  players: string[];
}

export interface LLMRequest {
  model: ModelProvider;
  modelId: string;
  prompt: string;
  systemPrompt?: string;
  temperature: number;
  maxTokens: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  tokensUsed: { input: number; output: number };
  responseTimeMs: number;
  finishReason: string;
}

export interface ExperimentState {
  experimentId: string;
  config: ExperimentConfig;
  phase: 'setup' | 'running' | 'paused' | 'completed' | 'error';
  currentCondition?: {
    gameType: GameType;
    stake: StakeSize;
    iteration: IterationType;
  };
  progress: {
    totalSessions: number;
    completedSessions: number;
    totalDecisions: number;
    completedDecisions: number;
  };
  startedAt?: string;
  lastActivityAt?: string;
}

// Arena-specific types for multi-agent economic simulation

export interface ArenaConfig {
  name: string;
  description: string;
  totalRounds: number;
  startingBalance: number;
  agents: ArenaAgentGroup[];
  rules: ArenaRules;
  temperature: number;
  revealModelType: boolean;
  publicMessageHistory: number;
  privateMessageHistory: number;
}

export interface ArenaAgentGroup {
  count: number;
  model: 'claude' | 'openai';
  modelId: string;
}

export interface ArenaRules {
  maxTransfersPerRound: number;
  maxPrivateMessagesPerRound: number;
  maxBroadcastsPerRound: number;
  minTransferAmount: number;
  announceFinalRound: boolean;
}

export interface ArenaAgent {
  id: string;
  anonymousName: string; // "Agent-1", "Agent-2", etc.
  model: 'claude' | 'openai';
  modelId: string;
  lightningAgentId?: number;
  lightningApiKey?: string;
  balance: number;
}

export interface ArenaMessage {
  id: string;
  round: number;
  fromAgentId: string;
  fromName: string;
  toAgentId: string | null; // null = broadcast
  toName: string | null;
  content: string;
  type: 'private' | 'public';
}

export interface ArenaTransfer {
  id: string;
  round: number;
  fromAgentId: string;
  fromName: string;
  toAgentId: string;
  toName: string;
  amount: number;
  success: boolean;
  errorMessage?: string;
}

export type ArenaActionType = 'send' | 'message' | 'broadcast' | 'pass';

export interface ArenaParsedAction {
  type: ArenaActionType;
  targetName?: string;
  amount?: number;
  content?: string;
  raw: string;
  valid: boolean;
  error?: string;
}

export interface ArenaRoundSummary {
  round: number;
  balanceBefore: Map<string, number>;
  balanceAfter: Map<string, number>;
  actions: Map<string, ArenaParsedAction[]>;
  transfers: ArenaTransfer[];
  messages: ArenaMessage[];
  eliminatedThisRound: string[]; // agent IDs that hit 0 balance
}

export interface ArenaPromptContext {
  agentName: string;
  agentModel?: string; // only if revealModelType is true
  balance: number;
  round: number;
  totalRounds: number;
  allAgentNames: string[];
  eliminatedNames: string[]; // agents at 0 balance
  publicMessages: ArenaMessage[];
  privateMessages: ArenaMessage[];
  rules: ArenaRules;
  isFinalRound: boolean;
}

export interface ArenaExperimentResult {
  experimentId: string;
  config: ArenaConfig;
  agents: ArenaAgent[];
  rounds: ArenaRoundSummary[];
  finalBalances: Map<string, number>;
  totalTransfers: number;
  totalMessages: number;
}

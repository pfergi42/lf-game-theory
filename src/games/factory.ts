import type { GameType } from '../types.js';
import type { GameConfig } from './engine.js';
import { BaseGame } from './engine.js';
import { PrisonersDilemma } from './prisoners-dilemma.js';
import { UltimatumGame } from './ultimatum.js';
import { TrustGame } from './trust.js';
import { PublicGoodsGame } from './public-goods.js';
import { DictatorGame } from './dictator.js';
import { LLMRouter } from '../llm/router.js';
import { DataStore } from '../data/store.js';
import { AgentManager } from '../agents/manager.js';

export function createGame(
  config: GameConfig,
  llm: LLMRouter,
  store: DataStore,
  agentManager: AgentManager
): BaseGame {
  switch (config.gameType) {
    case 'prisoners-dilemma':
      return new PrisonersDilemma(config, llm, store, agentManager);
    case 'ultimatum':
      return new UltimatumGame(config, llm, store, agentManager);
    case 'trust':
      return new TrustGame(config, llm, store, agentManager);
    case 'public-goods':
      return new PublicGoodsGame(config, llm, store, agentManager);
    case 'dictator':
      return new DictatorGame(config, llm, store, agentManager);
    default:
      throw new Error(`Unknown game type: ${config.gameType}`);
  }
}

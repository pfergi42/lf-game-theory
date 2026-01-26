/**
 * Export experiment data to JSON format for the interactive visualization.
 * Generates a single JSON file that the static HTML viewer can consume.
 */

import { DataStore } from './store.js';
import { writeFileSync } from 'fs';

interface VizSession {
  id: string;
  gameType: string;
  stake: number;
  iterationType: string;
  totalRounds: number;
  players: VizPlayer[];
  rounds: VizRound[];
}

interface VizPlayer {
  agentId: string;
  name: string;
  model: string;
  primingCondition: string;
  role?: string;
}

interface VizRound {
  round: number;
  decisions: VizDecision[];
}

interface VizDecision {
  agentId: string;
  action: string;
  payoff: number;
  responseTimeMs: number;
  prompt: string;
  rawResponse: string;
  tokensUsed: number;
}

interface VizData {
  experiment: {
    name: string;
    id: string;
    totalAgents: number;
    totalSessions: number;
    totalDecisions: number;
  };
  agents: Array<{
    id: string;
    name: string;
    model: string;
    primingCondition: string;
    totalPayoff: number;
    gamesPlayed: number;
  }>;
  sessions: VizSession[];
  aggregates: {
    cooperationByModel: Record<string, number>;
    cooperationByPriming: Record<string, number>;
    cooperationByStake: Record<number, number>;
    cooperationByRound: Array<{ round: number; rate: number; n: number }>;
    ultimatumOffers: number[];
    trustInvestments: number[];
    publicGoodsContributions: number[];
    dictatorGiving: number[];
  };
}

export function exportForVisualization(dbPath: string, experimentId: string, outputPath: string): void {
  const store = new DataStore(dbPath);

  const experiment = store.getExperiment(experimentId);
  if (!experiment) {
    throw new Error(`Experiment ${experimentId} not found`);
  }

  const agents = store.getAgents(experimentId);
  const sessions = store.getSessionsByExperiment(experimentId, 'completed');

  // Build session replays
  const vizSessions: VizSession[] = sessions.map(session => {
    const decisions = store.getDecisions(session.id);
    const rounds: VizRound[] = [];

    for (let r = 1; r <= session.totalRounds; r++) {
      const roundDecisions = decisions.filter(d => d.round === r);
      rounds.push({
        round: r,
        decisions: roundDecisions.map(d => ({
          agentId: d.agentId,
          action: d.action,
          payoff: d.payoff,
          responseTimeMs: d.responseTimeMs,
          prompt: d.prompt,
          rawResponse: d.rawResponse,
          tokensUsed: (d as any).tokensInput + (d as any).tokensOutput || 0,
        })),
      });
    }

    const players = session.players.map(pid => {
      const agent = agents.find(a => a.id === pid);
      return {
        agentId: pid,
        name: agent?.name || 'unknown',
        model: agent?.model || 'unknown',
        primingCondition: agent?.primingCondition || 'unknown',
      };
    });

    return {
      id: session.id,
      gameType: session.gameType,
      stake: session.stake,
      iterationType: session.iteration,
      totalRounds: session.totalRounds,
      players,
      rounds,
    };
  });

  // Build aggregates
  const allDecisions = sessions.flatMap(s => store.getDecisions(s.id));

  const pdDecisions = allDecisions.filter(d => {
    const session = sessions.find(s => s.id === d.sessionId);
    return session?.gameType === 'prisoners-dilemma';
  });

  // Cooperation by model
  const cooperationByModel: Record<string, number> = {};
  for (const model of ['claude', 'openai']) {
    const modelAgentIds = agents.filter(a => a.model === model).map(a => a.id);
    const modelDecisions = pdDecisions.filter(d => modelAgentIds.includes(d.agentId));
    const coopCount = modelDecisions.filter(d => d.action === 'cooperate').length;
    cooperationByModel[model] = modelDecisions.length > 0 ? coopCount / modelDecisions.length : 0;
  }

  // Cooperation by priming condition
  const cooperationByPriming: Record<string, number> = {};
  for (const condition of ['neutral', 'self-interest', 'cooperative']) {
    const conditionAgentIds = agents.filter(a => a.primingCondition === condition).map(a => a.id);
    const conditionDecisions = pdDecisions.filter(d => conditionAgentIds.includes(d.agentId));
    const coopCount = conditionDecisions.filter(d => d.action === 'cooperate').length;
    cooperationByPriming[condition] = conditionDecisions.length > 0 ? coopCount / conditionDecisions.length : 0;
  }

  // Cooperation by stake
  const cooperationByStake: Record<number, number> = {};
  for (const stake of [1, 10, 100, 1000]) {
    const stakeSessions = sessions.filter(s => s.stake === stake && s.gameType === 'prisoners-dilemma');
    const stakeDecisions = stakeSessions.flatMap(s => store.getDecisions(s.id));
    const coopCount = stakeDecisions.filter(d => d.action === 'cooperate').length;
    cooperationByStake[stake] = stakeDecisions.length > 0 ? coopCount / stakeDecisions.length : 0;
  }

  // Cooperation by round (iterated PD)
  const iteratedSessions = sessions.filter(s => s.gameType === 'prisoners-dilemma' && s.totalRounds > 1);
  const maxRound = Math.max(...iteratedSessions.map(s => s.totalRounds), 0);
  const cooperationByRound: Array<{ round: number; rate: number; n: number }> = [];
  for (let r = 1; r <= maxRound; r++) {
    const roundDecisions = iteratedSessions.flatMap(s => store.getDecisions(s.id).filter(d => d.round === r));
    const coopCount = roundDecisions.filter(d => d.action === 'cooperate').length;
    if (roundDecisions.length > 0) {
      cooperationByRound.push({ round: r, rate: coopCount / roundDecisions.length, n: roundDecisions.length });
    }
  }

  // Numeric action distributions
  const extractNumbers = (prefix: string, gameType: string): number[] => {
    const gameSessions = sessions.filter(s => s.gameType === gameType);
    const gameDecisions = gameSessions.flatMap(s => store.getDecisions(s.id));
    return gameDecisions
      .filter(d => d.action.startsWith(prefix))
      .map(d => parseInt(d.action.split('_')[1] || '0', 10))
      .filter(n => !isNaN(n));
  };

  // Agent summaries
  const agentSummaries = agents.map(agent => {
    const agentDecisions = allDecisions.filter(d => d.agentId === agent.id);
    const totalPayoff = agentDecisions.reduce((sum, d) => sum + d.payoff, 0);
    const gamesPlayed = new Set(agentDecisions.map(d => d.sessionId)).size;
    return {
      id: agent.id,
      name: agent.name,
      model: agent.model,
      primingCondition: agent.primingCondition,
      totalPayoff,
      gamesPlayed,
    };
  });

  const vizData: VizData = {
    experiment: {
      name: experiment.name as string,
      id: experimentId,
      totalAgents: agents.length,
      totalSessions: sessions.length,
      totalDecisions: allDecisions.length,
    },
    agents: agentSummaries,
    sessions: vizSessions,
    aggregates: {
      cooperationByModel,
      cooperationByPriming,
      cooperationByStake,
      cooperationByRound,
      ultimatumOffers: extractNumbers('offer', 'ultimatum'),
      trustInvestments: extractNumbers('invest', 'trust'),
      publicGoodsContributions: extractNumbers('contribute', 'public-goods'),
      dictatorGiving: extractNumbers('give', 'dictator'),
    },
  };

  writeFileSync(outputPath, JSON.stringify(vizData, null, 2), 'utf-8');
  console.log(`Exported visualization data: ${agents.length} agents, ${sessions.length} sessions, ${allDecisions.length} decisions`);
  console.log(`Output: ${outputPath}`);

  store.close();
}

// CLI entry point
if (process.argv[2]) {
  const dbPath = process.argv[2];
  const experimentId = process.argv[3] || '';
  const outputPath = process.argv[4] || 'viz/data.json';
  exportForVisualization(dbPath, experimentId, outputPath);
}

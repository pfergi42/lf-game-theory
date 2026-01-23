import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuid } from 'uuid';
import type {
  AgentConfig,
  Decision,
  ExperimentConfig,
  ExperimentState,
  GameSession,
  GameType,
  IterationType,
  Payment,
  StakeSize,
} from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class DataStore {
  private db: Database.Database;

  constructor(dbPath: string = 'experiment.db') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initSchema();
  }

  private initSchema(): void {
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    this.db.exec(schema);
  }

  close(): void {
    this.db.close();
  }

  // --- Experiments ---

  createExperiment(name: string, description: string, configYaml: string): string {
    const id = uuid();
    this.db.prepare(`
      INSERT INTO experiments (id, name, description, config_yaml, phase)
      VALUES (?, ?, ?, ?, 'setup')
    `).run(id, name, description, configYaml);
    return id;
  }

  updateExperimentPhase(id: string, phase: string): void {
    const now = new Date().toISOString();
    if (phase === 'running') {
      this.db.prepare(`UPDATE experiments SET phase = ?, started_at = ? WHERE id = ?`)
        .run(phase, now, id);
    } else if (phase === 'completed') {
      this.db.prepare(`UPDATE experiments SET phase = ?, completed_at = ? WHERE id = ?`)
        .run(phase, now, id);
    } else {
      this.db.prepare(`UPDATE experiments SET phase = ? WHERE id = ?`).run(phase, id);
    }
  }

  getExperiment(id: string): Record<string, unknown> | undefined {
    return this.db.prepare(`SELECT * FROM experiments WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  }

  // --- Agents ---

  createAgent(agent: AgentConfig & { experimentId: string; groupIndex: number }): void {
    this.db.prepare(`
      INSERT INTO agents (id, experiment_id, name, model_provider, model_id, knowledge_level, lightning_agent_id, lightning_api_key, group_index)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      agent.id, agent.experimentId, agent.name,
      agent.model, agent.modelId, agent.knowledgeLevel,
      agent.lightningAgentId ?? null, agent.lightningApiKey ?? null,
      agent.groupIndex
    );
  }

  updateAgentLightning(agentId: string, lightningAgentId: number, apiKey: string): void {
    this.db.prepare(`
      UPDATE agents SET lightning_agent_id = ?, lightning_api_key = ? WHERE id = ?
    `).run(lightningAgentId, apiKey, agentId);
  }

  getAgents(experimentId: string): AgentConfig[] {
    const rows = this.db.prepare(`
      SELECT * FROM agents WHERE experiment_id = ?
    `).all(experimentId) as Array<Record<string, unknown>>;
    return rows.map(r => ({
      id: r.id as string,
      name: r.name as string,
      model: r.model_provider as AgentConfig['model'],
      modelId: r.model_id as string,
      knowledgeLevel: r.knowledge_level as AgentConfig['knowledgeLevel'],
      lightningAgentId: r.lightning_agent_id as number | undefined,
      lightningApiKey: r.lightning_api_key as string | undefined,
    }));
  }

  getAgent(agentId: string): AgentConfig | undefined {
    const r = this.db.prepare(`SELECT * FROM agents WHERE id = ?`).get(agentId) as Record<string, unknown> | undefined;
    if (!r) return undefined;
    return {
      id: r.id as string,
      name: r.name as string,
      model: r.model_provider as AgentConfig['model'],
      modelId: r.model_id as string,
      knowledgeLevel: r.knowledge_level as AgentConfig['knowledgeLevel'],
      lightningAgentId: r.lightning_agent_id as number | undefined,
      lightningApiKey: r.lightning_api_key as string | undefined,
    };
  }

  // --- Sessions ---

  createSession(session: Omit<GameSession, 'status' | 'startedAt' | 'completedAt'> & { conditionIndex?: number }): string {
    this.db.prepare(`
      INSERT INTO sessions (id, experiment_id, game_type, stake, iteration_type, total_rounds, players, status, condition_index)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(
      session.id, session.experimentId, session.gameType,
      session.stake, session.iteration, session.totalRounds,
      JSON.stringify(session.players), session.conditionIndex ?? null
    );
    return session.id;
  }

  updateSessionStatus(id: string, status: GameSession['status']): void {
    const now = new Date().toISOString();
    if (status === 'in-progress') {
      this.db.prepare(`UPDATE sessions SET status = ?, started_at = ? WHERE id = ?`)
        .run(status, now, id);
    } else if (status === 'completed' || status === 'error') {
      this.db.prepare(`UPDATE sessions SET status = ?, completed_at = ? WHERE id = ?`)
        .run(status, now, id);
    } else {
      this.db.prepare(`UPDATE sessions SET status = ? WHERE id = ?`).run(status, id);
    }
  }

  getSession(id: string): GameSession | undefined {
    const r = this.db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    if (!r) return undefined;
    return {
      id: r.id as string,
      experimentId: r.experiment_id as string,
      gameType: r.game_type as GameType,
      stake: r.stake as StakeSize,
      iteration: r.iteration_type as IterationType,
      round: 0,
      totalRounds: r.total_rounds as number,
      players: JSON.parse(r.players as string),
      status: r.status as GameSession['status'],
      startedAt: r.started_at as string | undefined,
      completedAt: r.completed_at as string | undefined,
    };
  }

  getSessionsByExperiment(experimentId: string, status?: string): GameSession[] {
    let query = `SELECT * FROM sessions WHERE experiment_id = ?`;
    const params: unknown[] = [experimentId];
    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }
    const rows = this.db.prepare(query).all(...params) as Array<Record<string, unknown>>;
    return rows.map(r => ({
      id: r.id as string,
      experimentId: r.experiment_id as string,
      gameType: r.game_type as GameType,
      stake: r.stake as StakeSize,
      iteration: r.iteration_type as IterationType,
      round: 0,
      totalRounds: r.total_rounds as number,
      players: JSON.parse(r.players as string),
      status: r.status as GameSession['status'],
      startedAt: r.started_at as string | undefined,
      completedAt: r.completed_at as string | undefined,
    }));
  }

  // --- Decisions ---

  recordDecision(decision: {
    sessionId: string;
    agentId: string;
    round: number;
    action: string;
    parsedAction: Record<string, unknown>;
    rawResponse: string;
    prompt: string;
    payoff: number;
    responseTimeMs: number;
    tokensInput?: number;
    tokensOutput?: number;
    optionOrder?: string[];
  }): string {
    const id = uuid();
    this.db.prepare(`
      INSERT INTO decisions (id, session_id, agent_id, round, action, action_data, raw_response, prompt, payoff, response_time_ms, tokens_input, tokens_output, option_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, decision.sessionId, decision.agentId, decision.round,
      decision.action, JSON.stringify(decision.parsedAction),
      decision.rawResponse, decision.prompt, decision.payoff,
      decision.responseTimeMs,
      decision.tokensInput ?? null,
      decision.tokensOutput ?? null,
      decision.optionOrder ? JSON.stringify(decision.optionOrder) : null
    );
    return id;
  }

  getDecisions(sessionId: string, round?: number): Decision[] {
    let query = `SELECT * FROM decisions WHERE session_id = ?`;
    const params: unknown[] = [sessionId];
    if (round !== undefined) {
      query += ` AND round = ?`;
      params.push(round);
    }
    query += ` ORDER BY round, timestamp`;
    const rows = this.db.prepare(query).all(...params) as Array<Record<string, unknown>>;
    return rows.map(r => ({
      id: r.id as string,
      sessionId: r.session_id as string,
      agentId: r.agent_id as string,
      round: r.round as number,
      action: r.action as string,
      rawResponse: r.raw_response as string,
      prompt: r.prompt as string,
      parsedAction: JSON.parse((r.action_data as string) || '{}'),
      payoff: r.payoff as number,
      responseTimeMs: r.response_time_ms as number,
      timestamp: r.timestamp as string,
    }));
  }

  getAgentDecisions(agentId: string, gameType?: string): Decision[] {
    let query = `SELECT d.* FROM decisions d JOIN sessions s ON d.session_id = s.id WHERE d.agent_id = ?`;
    const params: unknown[] = [agentId];
    if (gameType) {
      query += ` AND s.game_type = ?`;
      params.push(gameType);
    }
    query += ` ORDER BY d.timestamp`;
    const rows = this.db.prepare(query).all(...params) as Array<Record<string, unknown>>;
    return rows.map(r => ({
      id: r.id as string,
      sessionId: r.session_id as string,
      agentId: r.agent_id as string,
      round: r.round as number,
      action: r.action as string,
      rawResponse: r.raw_response as string,
      prompt: r.prompt as string,
      parsedAction: JSON.parse((r.action_data as string) || '{}'),
      payoff: r.payoff as number,
      responseTimeMs: r.response_time_ms as number,
      timestamp: r.timestamp as string,
    }));
  }

  // --- Payments ---

  recordPayment(payment: Omit<Payment, 'id' | 'timestamp'>): string {
    const id = uuid();
    this.db.prepare(`
      INSERT INTO payments (id, session_id, from_agent_id, to_agent_id, amount, reason, lightning_tx_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, payment.sessionId ?? null, payment.fromAgentId ?? null,
      payment.toAgentId, payment.amount, payment.reason,
      payment.lightningTxId ?? null, 'completed'
    );
    return id;
  }

  getPayments(sessionId: string): Payment[] {
    const rows = this.db.prepare(`
      SELECT * FROM payments WHERE session_id = ? ORDER BY timestamp
    `).all(sessionId) as Array<Record<string, unknown>>;
    return rows.map(r => ({
      id: r.id as string,
      sessionId: r.session_id as string,
      fromAgentId: r.from_agent_id as string | null,
      toAgentId: r.to_agent_id as string,
      amount: r.amount as number,
      reason: r.reason as string,
      lightningTxId: r.lightning_tx_id as string | undefined,
      timestamp: r.timestamp as string,
    }));
  }

  // --- Balances ---

  updateBalance(agentId: string, experimentId: string, balance: number): void {
    this.db.prepare(`
      INSERT INTO balances (agent_id, experiment_id, balance, last_updated)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(agent_id, experiment_id) DO UPDATE SET balance = ?, last_updated = datetime('now')
    `).run(agentId, experimentId, balance, balance);
  }

  getBalance(agentId: string, experimentId: string): number {
    const row = this.db.prepare(`
      SELECT balance FROM balances WHERE agent_id = ? AND experiment_id = ?
    `).get(agentId, experimentId) as { balance: number } | undefined;
    return row?.balance ?? 0;
  }

  // --- Logging ---

  log(experimentId: string, level: string, message: string, metadata?: Record<string, unknown>): void {
    this.db.prepare(`
      INSERT INTO experiment_log (experiment_id, level, message, metadata)
      VALUES (?, ?, ?, ?)
    `).run(experimentId, level, message, metadata ? JSON.stringify(metadata) : null);
  }

  // --- Aggregation queries for analysis ---

  getCooperationRate(experimentId: string, gameType: string, stake?: number): number {
    let query = `
      SELECT
        CAST(SUM(CASE WHEN d.action = 'cooperate' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) as rate
      FROM decisions d
      JOIN sessions s ON d.session_id = s.id
      WHERE s.experiment_id = ? AND s.game_type = ?
    `;
    const params: unknown[] = [experimentId, gameType];
    if (stake !== undefined) {
      query += ` AND s.stake = ?`;
      params.push(stake);
    }
    const row = this.db.prepare(query).get(...params) as { rate: number } | undefined;
    return row?.rate ?? 0;
  }

  getDecisionCounts(experimentId: string): Array<{ game_type: string; action: string; count: number }> {
    return this.db.prepare(`
      SELECT s.game_type, d.action, COUNT(*) as count
      FROM decisions d
      JOIN sessions s ON d.session_id = s.id
      WHERE s.experiment_id = ?
      GROUP BY s.game_type, d.action
      ORDER BY s.game_type, d.action
    `).all(experimentId) as Array<{ game_type: string; action: string; count: number }>;
  }

  getExperimentState(experimentId: string): ExperimentState | undefined {
    const exp = this.getExperiment(experimentId);
    if (!exp) return undefined;

    const totalSessions = (this.db.prepare(
      `SELECT COUNT(*) as c FROM sessions WHERE experiment_id = ?`
    ).get(experimentId) as { c: number }).c;

    const completedSessions = (this.db.prepare(
      `SELECT COUNT(*) as c FROM sessions WHERE experiment_id = ? AND status = 'completed'`
    ).get(experimentId) as { c: number }).c;

    const totalDecisions = (this.db.prepare(
      `SELECT COUNT(*) as c FROM decisions d JOIN sessions s ON d.session_id = s.id WHERE s.experiment_id = ?`
    ).get(experimentId) as { c: number }).c;

    return {
      experimentId,
      config: {} as ExperimentConfig,
      phase: exp.phase as ExperimentState['phase'],
      progress: {
        totalSessions,
        completedSessions,
        totalDecisions,
        completedDecisions: totalDecisions,
      },
      startedAt: exp.started_at as string | undefined,
    };
  }

  // --- Export ---

  exportDecisionsCSV(experimentId: string): string {
    const rows = this.db.prepare(`
      SELECT
        d.id, d.session_id, d.agent_id, d.round, d.action, d.payoff, d.response_time_ms,
        d.tokens_input, d.tokens_output, d.option_order, d.timestamp,
        s.game_type, s.stake, s.iteration_type, s.total_rounds,
        a.model_provider, a.model_id, a.knowledge_level, a.group_index
      FROM decisions d
      JOIN sessions s ON d.session_id = s.id
      JOIN agents a ON d.agent_id = a.id
      WHERE s.experiment_id = ?
      ORDER BY s.game_type, s.stake, d.session_id, d.round, d.agent_id
    `).all(experimentId) as Array<Record<string, unknown>>;

    if (rows.length === 0) return '';

    const headers = Object.keys(rows[0]).join(',');
    const lines = rows.map(r => Object.values(r).map(v =>
      typeof v === 'string' && v.includes(',') ? `"${v}"` : v ?? ''
    ).join(','));

    return [headers, ...lines].join('\n');
  }
}
